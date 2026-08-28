import { randomUUID } from "crypto";
import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";

function estadoCongelado(cifra) {
  return {
    id: cifra.id,
    titulo: cifra.titulo,
    artista: cifra.artista,
    tom: cifra.tom,
    instrumento: cifra.instrumento,
    blocos: cifra.blocos,
    acordesCustomizadosUsados: cifra.acordesCustomizadosUsados,
    configuracaoPdf: cifra.configuracaoPdf,
  };
}

export default class ApostilaService {
  constructor({
    apostilaRepository,
    cifraRepository,
    pagamentoRepository,
    usuarioRepository,
    diffService,
    paymentProviderAdapter,
    pdfService,
    auditService,
  }) {
    this.apostilaRepository = apostilaRepository;
    this.cifraRepository = cifraRepository;
    this.pagamentoRepository = pagamentoRepository;
    this.usuarioRepository = usuarioRepository;
    this.diffService = diffService;
    this.paymentProviderAdapter = paymentProviderAdapter;
    this.pdfService = pdfService;
    this.auditService = auditService;
  }

  async _isento(usuarioId) {
    const usuario = await this.usuarioRepository.findById(usuarioId);
    return usuario?.role === "ADMIN";
  }

  async _buscarCifrasDoUsuario(usuarioId, cifraIds) {
    const cifras = await this.cifraRepository.findMany({ id: { in: cifraIds }, usuarioId });
    if (cifras.length !== cifraIds.length) {
      throw ApiError.badRequest("Uma ou mais cifras informadas não pertencem a este usuário.");
    }
    return cifras;
  }

  /** POST /apostilas/quote — orçamento em modo dry-run (nenhum registro é criado). */
  async orcar(usuarioId, { cifraIds }) {
    const cifras = await this._buscarCifrasDoUsuario(usuarioId, cifraIds);
    const isento = await this._isento(usuarioId);

    let valorTotal = 0;
    const pagamentos = [];

    for (const cifra of cifras) {
      const estadoAtual = estadoCongelado(cifra);
      const diff = this.diffService.comparar(estadoAtual, cifra.versaoPagaSnapshot);
      if ((!diff.houveAlteracaoDeConteudo && !diff.primeiraExportacao) || isento) {
        pagamentos.push({ cifraId: cifra.id, tipo: "gratuito", valor: 0 });
        continue;
      }
      const tipo = diff.primeiraExportacao ? "criacao" : "edicao";
      const valor = tipo === "criacao" ? env.PRICE_CRIACAO : env.PRICE_EDICAO;
      valorTotal += valor;
      pagamentos.push({ cifraId: cifra.id, tipo, valor });
    }

    return { pagamentos, valorTotal };
  }

  /**
   * Cada cifra incluída é tratada individualmente pela regra de cobrança
   * (seção 11) e somada num único checkout antes de gerar o PDF consolidado.
   */
  async criarESolicitarExportacao(usuarioId, { titulo, cifraIds }, metodo, ctx = {}) {
    const cifras = await this._buscarCifrasDoUsuario(usuarioId, cifraIds);
    const isento = await this._isento(usuarioId);

    const apostila = await this.apostilaRepository.create({
      usuarioId,
      titulo,
      itens: { create: cifraIds.map((cifraId, ordem) => ({ cifraId, ordem })) },
    });

    let valorTotal = 0;
    const itensCobraveis = [];
    const itensGratuitos = [];

    for (const cifra of cifras) {
      const estadoAtual = estadoCongelado(cifra);
      const diff = this.diffService.comparar(estadoAtual, cifra.versaoPagaSnapshot);
      if ((!diff.houveAlteracaoDeConteudo && !diff.primeiraExportacao) || isento) {
        itensGratuitos.push({ cifra, estadoAtual });
      } else {
        const tipo = diff.primeiraExportacao ? "criacao" : "edicao";
        const valor = tipo === "criacao" ? env.PRICE_CRIACAO : env.PRICE_EDICAO;
        valorTotal += valor;
        itensCobraveis.push({ cifra, estadoAtual, tipo, valor });
      }
    }

    if (itensCobraveis.length === 0) {
      // Todas as cifras já estão pagas e sem alteração (ou usuário isento): apostila sai na hora, grátis.
      const pdf = await this.pdfService.gerarPdfApostila(
        titulo,
        itensGratuitos.map((i) => i.estadoAtual),
      );
      await this.apostilaRepository.update(apostila.id, { status: "approved" });

      if (isento) {
        // Registra os pagamentos a valor 0 (já aprovados) por auditoria/dashboard,
        // igual ao que ExportacaoService faz para uma cifra isolada.
        await Promise.all(
          itensGratuitos.map((item) =>
            this.pagamentoRepository.create({
              cifraId: item.cifra.id,
              usuarioId,
              tipo: item.cifra.versaoPagaSnapshot ? "edicao" : "criacao",
              valor: 0,
              metodo: metodo ?? null,
              status: "approved",
              externalReference: `apostila-${apostila.id}-${item.cifra.id}-admin-${randomUUID()}`,
              providerPaymentId: null,
              snapshotNoMomentoDoPagamento: item.estadoAtual,
              aprovadoEm: new Date(),
              apostilaId: apostila.id,
            }),
          ),
        );
        await Promise.all(
          itensGratuitos.map((item) =>
            this.cifraRepository.update(item.cifra.id, {
              status: "pago",
              versaoPagaSnapshot: item.estadoAtual,
            }),
          ),
        );
      }

      return { gratuito: true, pdf, apostilaId: apostila.id };
    }

    const config = await this.paymentProviderAdapter.getConfig();
    const externalReference = `apostila-${apostila.id}-${randomUUID()}`;
    const pagamentoProvedor = await this.paymentProviderAdapter.criarPagamento({
      amount: valorTotal,
      description: `CifreAqui — Modo Apostila "${titulo}" (${itensCobraveis.length} cifra(s))`,
      externalReference,
      method: metodo,
    });

    // Um pagamento no provedor cobre a apostila inteira, mas mantemos um
    // registro de Pagamento POR CIFRA cobrável (mesmo providerPaymentId),
    // porque a regra de negócio (versaoPagaSnapshot, diff futuro) é sempre
    // por cifra — o webhook confirma todos de uma vez (ver PagamentoService).
    const pagamentosCriados = await Promise.all(
      itensCobraveis.map((item) =>
        this.pagamentoRepository.create({
          cifraId: item.cifra.id,
          usuarioId,
          tipo: item.tipo,
          valor: item.valor,
          metodo,
          status: "pending",
          externalReference: `${externalReference}-${item.cifra.id}`,
          providerPaymentId: pagamentoProvedor.id,
          snapshotNoMomentoDoPagamento: item.estadoAtual,
          apostilaId: apostila.id,
        }),
      ),
    );

    await this.auditService.log(
      "apostila.criada",
      "apostila",
      apostila.id,
      { totalCifras: cifras.length, cobraveis: itensCobraveis.length, valorTotal },
      { usuarioId, requestId: ctx.requestId },
    );

    return {
      gratuito: false,
      apostilaId: apostila.id,
      valorTotal,
      publicKey: config.publicKey,
      providerPaymentId: pagamentoProvedor.id,
      externalReference,
      pagamentos: pagamentosCriados.map((p) => ({ id: p.id, cifraId: p.cifraId, tipo: p.tipo, valor: p.valor })),
    };
  }

  /**
   * Gera (sob demanda) o PDF consolidado da apostila, reunindo os snapshots
   * congelados de cada Pagamento aprovado + o estado atual das cifras que já
   * estavam pagas e sem alteração (que nunca geraram um Pagamento novo).
   */
  async gerarPdfConsolidado(usuarioId, apostilaId) {
    const apostila = await this.apostilaRepository.findByIdAndUsuario(apostilaId, usuarioId);
    if (!apostila) throw ApiError.notFound("Apostila não encontrada.");
    if (apostila.status !== "approved") {
      throw ApiError.paymentRequired("Esta apostila ainda não teve o pagamento aprovado.");
    }

    const pagamentosAprovados = await this.pagamentoRepository.listByUsuario(usuarioId, {
      where: { apostilaId, status: "approved" },
    });
    const idsComPagamento = new Set(pagamentosAprovados.map((p) => p.cifraId));

    const snapshots = [
      ...pagamentosAprovados
        .sort(
          (a, b) =>
            apostila.itens.findIndex((i) => i.cifraId === a.cifraId) -
            apostila.itens.findIndex((i) => i.cifraId === b.cifraId),
        )
        .map((p) => ({ ...p.snapshotNoMomentoDoPagamento, id: p.cifraId })),
      ...apostila.itens
        .filter((i) => !idsComPagamento.has(i.cifraId))
        .map((i) => ({ ...estadoCongelado(i.cifra), id: i.cifra.id })),
    ];

    return this.pdfService.gerarPdfApostila(apostila.titulo, snapshots);
  }
}
