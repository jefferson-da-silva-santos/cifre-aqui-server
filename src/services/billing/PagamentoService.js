import { ApiError } from "../../utils/ApiError.js";

export default class PagamentoService {
  constructor({
    pagamentoRepository,
    webhookEventRepository,
    paymentProviderAdapter,
    exportacaoService,
    apostilaRepository,
    pdfService,
    auditService,
  }) {
    this.pagamentoRepository = pagamentoRepository;
    this.webhookEventRepository = webhookEventRepository;
    this.paymentProviderAdapter = paymentProviderAdapter;
    this.exportacaoService = exportacaoService;
    this.apostilaRepository = apostilaRepository;
    this.pdfService = pdfService;
    this.auditService = auditService;
  }

  listarPorUsuario(usuarioId, opts) {
    return this.pagamentoRepository.listByUsuario(usuarioId, opts);
  }

  /**
   * Processa a notificação de webhook do payment-system-mp. O backend NUNCA
   * confia no corpo da notificação como fonte de verdade — usa o id recebido
   * pra consultar o provedor (`syncWithMp=true`) e só então decide liberar o
   * PDF (seção 12). Todo evento é logado em WebhookEvent para idempotência.
   */
  async processarWebhook(payloadNotificacao, ctx = {}) {
    const providerPaymentId = String(
      payloadNotificacao.data?.id ?? payloadNotificacao.id ?? "",
    );
    if (!providerPaymentId) {
      throw ApiError.badRequest("Notificação de webhook sem id de pagamento.");
    }

    const jaExiste = await this.webhookEventRepository.findByProviderEventId(providerPaymentId);
    if (jaExiste?.processedAt) {
      await this.auditService.log("webhook.duplicado", "pagamento", providerPaymentId, {}, ctx);
      return { duplicado: true };
    }

    const evento =
      jaExiste ??
      (await this.webhookEventRepository.create({
        providerEventId: providerPaymentId,
        payload: payloadNotificacao,
      }));

    await this.auditService.log("webhook.recebido", "pagamento", providerPaymentId, {}, ctx);

    // Fonte de verdade: consulta real ao provedor, nunca o corpo da notificação.
    const statusReal = await this.paymentProviderAdapter.consultarPagamento(providerPaymentId, {
      syncWithMp: true,
    });

    const pagamento = await this.pagamentoRepository.findByProviderPaymentId(providerPaymentId);
    if (!pagamento) {
      // Evento de um pagamento que não reconhecemos (ex: ambiente de teste do
      // provedor) — logamos e ignoramos sem erro, para não derrubar o webhook.
      await this.webhookEventRepository.markProcessed(evento.id);
      return { pagamentoDesconhecido: true };
    }

    // Modo Apostila: um único providerPaymentId pode cobrir vários registros de
    // Pagamento (um por cifra cobrável) — confirmamos/rejeitamos todos juntos.
    const pagamentosRelacionados = pagamento.apostilaId
      ? await this.pagamentoRepository.findManyByProviderPaymentId(providerPaymentId)
      : [pagamento];

    const resultados = [];
    for (const p of pagamentosRelacionados) {
      if (statusReal.status === "approved") {
        resultados.push(await this.exportacaoService.confirmarPagamentoAprovado(p, ctx));
      } else if (statusReal.status === "rejected" || statusReal.status === "cancelled") {
        resultados.push(await this.exportacaoService.rejeitarPagamento(p, ctx));
      } else {
        resultados.push({ statusInalterado: statusReal.status });
      }
    }

    if (pagamento.apostilaId && statusReal.status === "approved") {
      await this._finalizarApostilaSeCompleta(pagamento.apostilaId, ctx);
    }

    await this.webhookEventRepository.markProcessed(evento.id);
    return { resultados };
  }

  async _finalizarApostilaSeCompleta(apostilaId, ctx) {
    const apostila = await this.apostilaRepository.findById(apostilaId);
    if (!apostila || apostila.status === "approved") return;

    await this.apostilaRepository.update(apostilaId, { status: "approved" });
    await this.auditService.log("apostila.finalizada", "apostila", apostilaId, {}, ctx);
    // Observação: o PDF consolidado da apostila é servido sob demanda pela rota
    // de download (GET /apostilas/:id/pdf), reaproveitando os snapshots já
    // congelados em cada Pagamento — evita gerar um PDF pesado dentro do webhook.
  }

  async estornar(usuarioId, pagamentoId) {
    const pagamento = await this._obterDoUsuario(usuarioId, pagamentoId);
    return this.paymentProviderAdapter.estornarPagamento(pagamento.providerPaymentId);
  }

  async cancelar(usuarioId, pagamentoId) {
    const pagamento = await this._obterDoUsuario(usuarioId, pagamentoId);
    return this.paymentProviderAdapter.cancelarPagamento(pagamento.providerPaymentId);
  }

  async recibo(usuarioId, pagamentoId) {
    const pagamento = await this._obterDoUsuario(usuarioId, pagamentoId);
    return this.paymentProviderAdapter.obterRecibo(pagamento.providerPaymentId);
  }

  async _obterDoUsuario(usuarioId, pagamentoId) {
    const pagamento = await this.pagamentoRepository.findById(pagamentoId);
    if (!pagamento || pagamento.usuarioId !== usuarioId) {
      throw ApiError.notFound("Pagamento não encontrado.");
    }
    return pagamento;
  }
}
