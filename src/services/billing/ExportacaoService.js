import { randomUUID } from "crypto";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

function estadoCongelado(cifra) {
  // "Congela" exatamente o que entra no PDF e o que conta pra diff — evita
  // vazar campos internos do Prisma (createdAt interno, relations etc.).
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

export default class ExportacaoService {
  constructor({
    cifraService,
    cifraRepository,
    pagamentoRepository,
    usuarioRepository,
    diffService,
    paymentProviderAdapter,
    pdfService,
    auditService,
  }) {
    this.cifraService = cifraService;
    this.cifraRepository = cifraRepository;
    this.pagamentoRepository = pagamentoRepository;
    this.usuarioRepository = usuarioRepository;
    this.diffService = diffService;
    this.paymentProviderAdapter = paymentProviderAdapter;
    this.pdfService = pdfService;
    this.auditService = auditService;
  }

  /** true para usuários ADMIN — exportação ilimitada sem cobrança (decisão sempre no backend). */
  async _isento(usuarioId) {
    const usuario = await this.usuarioRepository.findById(usuarioId);
    return usuario?.role === "ADMIN";
  }

  /**
   * GET /cifras/:id/export-quote — orçamento em modo dry-run: calcula preço e
   * diff SEM criar cobrança nem tocar em nenhum registro. Usado pela tela de
   * confirmação antes do usuário decidir exportar.
   */
  async orcar(usuarioId, cifraId) {
    const cifra = await this.cifraService.obterOuFalhar(cifraId, usuarioId);
    this.cifraService.validarConteudoExportavel(cifra);

    const estadoAtual = estadoCongelado(cifra);
    const diff = this.diffService.comparar(estadoAtual, cifra.versaoPagaSnapshot);
    const diffs = this.diffService.detalhar(estadoAtual, cifra.versaoPagaSnapshot);
    const isento = await this._isento(usuarioId);

    const semAlteracao = !diff.houveAlteracaoDeConteudo && !diff.primeiraExportacao;
    const tipo = semAlteracao ? "gratuito" : diff.primeiraExportacao ? "criacao" : "edicao";
    const valor = semAlteracao || isento ? 0 : tipo === "criacao" ? env.PRICE_CRIACAO : env.PRICE_EDICAO;

    return {
      cifraId,
      tipo,
      valor,
      moeda: "BRL",
      diffs,
      precisaPagamento: !semAlteracao && !isento,
    };
  }

  /**
   * Fluxo 13.1/13.2/13.3: decide se a exportação é gratuita (sem diff, ou
   * usuário isento) ou precisa de checkout, e nesse caso já cria a cobrança
   * no provedor. `configuracaoPdfOverride` permite ajustar a formatação só
   * para esta exportação, sem persistir na cifra (nunca afeta cobrança).
   */
  async iniciarExportacao(usuarioId, cifraId, metodo, ctx = {}, configuracaoPdfOverride = null) {
    const cifra = await this.cifraService.obterOuFalhar(cifraId, usuarioId);
    this.cifraService.validarConteudoExportavel(cifra);

    const estadoAtual = estadoCongelado(cifra);
    if (configuracaoPdfOverride) {
      estadoAtual.configuracaoPdf = { ...estadoAtual.configuracaoPdf, ...configuracaoPdfOverride };
    }
    const diff = this.diffService.comparar(estadoAtual, cifra.versaoPagaSnapshot);

    if (!diff.houveAlteracaoDeConteudo && !diff.primeiraExportacao) {
      // 13.2 — reexportação sem alteração: PDF imediato, sem checkout.
      const pdf = await this.pdfService.gerarPdfCifra(estadoAtual);
      await this.auditService.log(
        "pdf.gerado",
        "cifra",
        cifraId,
        { gratuito: true },
        { usuarioId, requestId: ctx.requestId },
      );
      return { gratuito: true, pdf };
    }

    const tipo = diff.primeiraExportacao ? "criacao" : "edicao";
    const valorTabela = tipo === "criacao" ? env.PRICE_CRIACAO : env.PRICE_EDICAO;

    if (await this._isento(usuarioId)) {
      // ADMIN: exportação sempre liberada na hora, sem checkout — mas ainda
      // registramos um Pagamento (valor 0, já aprovado) para manter o
      // histórico/dashboard consistentes com o restante do sistema.
      const pdf = await this.pdfService.gerarPdfCifra(estadoAtual);
      await this.pagamentoRepository.create({
        cifraId,
        usuarioId,
        tipo,
        valor: 0,
        metodo: metodo ?? null,
        status: "approved",
        externalReference: `${cifraId}-${tipo}-admin-${randomUUID()}`,
        providerPaymentId: null,
        snapshotNoMomentoDoPagamento: estadoAtual,
        aprovadoEm: new Date(),
      });
      await this.cifraRepository.update(cifraId, {
        status: "pago",
        versaoPagaSnapshot: estadoAtual,
      });
      await this.auditService.log(
        "pdf.gerado",
        "cifra",
        cifraId,
        { gratuito: true, motivo: "isento_admin" },
        { usuarioId, requestId: ctx.requestId },
      );
      return { gratuito: true, pdf };
    }

    const externalReference = `${cifraId}-${tipo}-${randomUUID()}`;

    const config = await this.paymentProviderAdapter.getConfig();
    const pagamentoProvedor = await this.paymentProviderAdapter.criarPagamento({
      amount: valorTabela,
      description: `CifreAqui — ${tipo === "criacao" ? "exportação" : "reexportação com edição"} de "${cifra.titulo}"`,
      externalReference,
      method: metodo,
    });

    const pagamento = await this.pagamentoRepository.create({
      cifraId,
      usuarioId,
      tipo,
      valor: valorTabela,
      metodo,
      status: "pending",
      externalReference,
      providerPaymentId: pagamentoProvedor.id,
      // Congela o estado exato no instante da cobrança — se o usuário editar a
      // cifra enquanto o pagamento está pending, o PDF gerado após aprovação
      // reflete ESTE estado, não o editado depois (seção 11.3).
      snapshotNoMomentoDoPagamento: estadoAtual,
    });

    await this.auditService.log(
      "pagamento.criado",
      "pagamento",
      pagamento.id,
      { tipo, valor: valorTabela.toString() },
      { usuarioId, requestId: ctx.requestId },
    );

    return {
      gratuito: false,
      pagamento,
      publicKey: config.publicKey,
      apiBaseUrl: env.PAYMENT_API_BASE_URL,
    };
  }

  /** Consulta status atual (usado pelo frontend para polling, seção 13.1 passo 10). */
  async consultarStatus(usuarioId, pagamentoId) {
    const pagamento = await this.pagamentoRepository.findById(pagamentoId);
    if (!pagamento || pagamento.usuarioId !== usuarioId) {
      throw ApiError.notFound("Pagamento não encontrado.");
    }
    return pagamento;
  }

  /**
   * Chamado pelo webhook handler depois de confirmar (via consulta ao provedor,
   * nunca confiando no corpo da notificação) que o pagamento foi aprovado.
   */
  async confirmarPagamentoAprovado(pagamento, ctx = {}) {
    if (pagamento.status === "approved") {
      // Idempotência: webhook duplicado não deve gerar liberação/duplicação (seção 14).
      return { jaProcessado: true };
    }

    const cifraSnapshot = { ...pagamento.snapshotNoMomentoDoPagamento, id: pagamento.cifraId };

    let pdf;
    try {
      pdf = await this.pdfService.gerarPdfCifra(cifraSnapshot);
    } catch (err) {
      // Falha crítica: pagamento já aprovado, mas o Puppeteer falhou. Mantemos o
      // pagamento como approved (dinheiro já recebido) e deixamos pra reintentar
      // a geração sem cobrar de novo (seção 14) — não propagamos como rejeição.
      await this.pagamentoRepository.update(pagamento.id, {
        status: "approved",
        aprovadoEm: new Date(),
      });
      await this.auditService.log(
        "pdf.falha_geracao_pos_pagamento",
        "pagamento",
        pagamento.id,
        { erro: err.message },
        ctx,
      );
      throw err;
    }

    await this.pagamentoRepository.update(pagamento.id, {
      status: "approved",
      aprovadoEm: new Date(),
    });

    await this.cifraRepository.update(pagamento.cifraId, {
      status: "pago",
      versaoPagaSnapshot: pagamento.snapshotNoMomentoDoPagamento,
    });

    await this.auditService.log("pagamento.aprovado", "pagamento", pagamento.id, {}, ctx);
    await this.auditService.log(
      "pdf.gerado",
      "cifra",
      pagamento.cifraId,
      { gratuito: false, pagamentoId: pagamento.id },
      ctx,
    );

    return { jaProcessado: false, pdf };
  }

  async rejeitarPagamento(pagamento, ctx = {}) {
    if (pagamento.status !== "pending") return { jaProcessado: true };
    await this.pagamentoRepository.update(pagamento.id, { status: "rejected" });
    await this.auditService.log("pagamento.rejeitado", "pagamento", pagamento.id, {}, ctx);
    return { jaProcessado: false };
  }

  /** Tenta gerar novamente o PDF de um pagamento já aprovado, sem cobrar de novo. */
  async reprocessarPdf(usuarioId, pagamentoId, ctx = {}) {
    const pagamento = await this.pagamentoRepository.findById(pagamentoId);
    if (!pagamento || pagamento.usuarioId !== usuarioId) {
      throw ApiError.notFound("Pagamento não encontrado.");
    }
    if (pagamento.status !== "approved") {
      throw ApiError.conflict("Este pagamento ainda não foi aprovado.");
    }
    const cifraSnapshot = { ...pagamento.snapshotNoMomentoDoPagamento, id: pagamento.cifraId };
    const pdf = await this.pdfService.gerarPdfCifra(cifraSnapshot);
    await this.auditService.log(
      "pdf.gerado",
      "cifra",
      pagamento.cifraId,
      { reprocessado: true, pagamentoId },
      { usuarioId, requestId: ctx.requestId },
    );
    return pdf;
  }
}
