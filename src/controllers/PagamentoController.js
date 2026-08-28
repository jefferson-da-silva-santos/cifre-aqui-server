import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export default class PagamentoController {
  constructor(pagamentoService, paymentProviderAdapter) {
    this.pagamentoService = pagamentoService;
    this.paymentProviderAdapter = paymentProviderAdapter;

    this.config = asyncHandler(this.config.bind(this));
    this.webhook = asyncHandler(this.webhook.bind(this));
    this.listar = asyncHandler(this.listar.bind(this));
    this.estornar = asyncHandler(this.estornar.bind(this));
    this.cancelar = asyncHandler(this.cancelar.bind(this));
    this.recibo = asyncHandler(this.recibo.bind(this));
  }

  async config(req, res) {
    const config = await this.paymentProviderAdapter.getConfig();
    return ApiResponse.success(res, { data: config });
  }

  async webhook(req, res) {
    // Verificação de autenticidade antes de processar (seção 12) — fail-closed
    // se o segredo não estiver configurado em produção.
    const assinaturaValida = this.paymentProviderAdapter.validarAssinaturaWebhook(
      req.rawBody,
      req.headers["x-signature"] ?? req.headers["x-webhook-signature"],
    );
    if (!assinaturaValida) throw ApiError.unauthorized("Assinatura de webhook inválida.");

    const resultado = await this.pagamentoService.processarWebhook(req.body, {
      requestId: req.id,
    });

    // Sempre 200 para o provedor não reenviar indefinidamente eventos que já
    // tratamos como "conhecidos" (mesmo pagamento desconhecido/duplicado).
    return ApiResponse.success(res, { message: "Webhook processado.", data: resultado });
  }

  async listar(req, res) {
    const pagamentos = await this.pagamentoService.listarPorUsuario(req.user.id);
    return ApiResponse.success(res, { data: pagamentos });
  }

  async estornar(req, res) {
    const resultado = await this.pagamentoService.estornar(req.user.id, req.params.id);
    return ApiResponse.success(res, {
      message:
        "Solicitação de estorno enviada. Para casos não resolvidos automaticamente, use o WhatsApp de suporte.",
      data: resultado,
    });
  }

  async cancelar(req, res) {
    const resultado = await this.pagamentoService.cancelar(req.user.id, req.params.id);
    return ApiResponse.success(res, { data: resultado });
  }

  async recibo(req, res) {
    const resultado = await this.pagamentoService.recibo(req.user.id, req.params.id);
    return ApiResponse.success(res, { data: resultado });
  }
}
