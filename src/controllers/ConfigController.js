import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";

const METODOS_SUPORTADOS = ["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO", "ACCOUNT_MONEY"];

// GET /config — usado pelo frontend para montar o widget de pagamento e o
// link de suporte fora do fluxo de exportação (paymentService.config()).
// Não confundir com GET /pagamentos/config (contrato específico do widget do
// provedor) — este aqui agrega tudo que a tela de config do front precisa.
export default class ConfigController {
  constructor(paymentProviderAdapter) {
    this.paymentProviderAdapter = paymentProviderAdapter;
    this.obter = asyncHandler(this.obter.bind(this));
  }

  async obter(req, res) {
    const { publicKey } = await this.paymentProviderAdapter.getConfig();
    return ApiResponse.success(res, {
      data: {
        publicKey,
        apiBaseUrl: env.PAYMENT_API_BASE_URL ?? null,
        metodos: METODOS_SUPORTADOS,
        whatsappUrl: env.SUPPORT_WHATSAPP_URL,
      },
    });
  }
}
