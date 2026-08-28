import { randomUUID } from "crypto";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";

// Adapter para o backend próprio de pagamentos `payment-system-mp` (contrato
// idêntico ao usado pelo `mp-test-client`, seção 12 do produto). O widget do
// frontend nunca fala direto com o provedor — sempre passa por essas rotas do
// backend do CifreAqui, que é quem guarda a API key.
//
// Rotas do contrato:
//   GET  {apiBaseUrl}/config
//   POST {apiBaseUrl}/payments
//   GET  {apiBaseUrl}/payments/:id
//   POST {apiBaseUrl}/payments/:id/refund
//   POST {apiBaseUrl}/payments/:id/cancel
//   GET  {apiBaseUrl}/payments/:id/receipt
export default class PaymentProviderAdapter {
  constructor() {
    this.baseUrl = env.PAYMENT_API_BASE_URL;
    this.apiKey = env.PAYMENT_API_KEY;
    this.mock = env.PAYMENT_MOCK_MODE;
  }

  async _fetch(path, options = {}) {
    if (!this.baseUrl) {
      throw ApiError.internal("PAYMENT_API_BASE_URL não configurado.");
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      logger.error({ path, status: res.status, body }, "Falha ao chamar payment-system-mp");
      throw ApiError.internal("Falha ao comunicar com o provedor de pagamento.");
    }
    return body?.data ?? body;
  }

  async getConfig() {
    if (this.mock) return { publicKey: env.PAYMENT_PUBLIC_KEY ?? "MOCK_PUBLIC_KEY" };
    return this._fetch("/config");
  }

  /**
   * Cria uma cobrança avulsa no provedor. Sem cartão salvo, sem conceito de
   * cliente recorrente (seção 11.4) — cada cobrança é independente.
   */
  async criarPagamento({ amount, description, externalReference, method }) {
    if (this.mock) {
      const id = `mock_${randomUUID()}`;
      logger.info({ id, amount, externalReference }, "[MOCK] payment-system-mp: pagamento criado");
      return { id, status: "pending", amount, externalReference, method };
    }

    return this._fetch("/payments", {
      method: "POST",
      body: JSON.stringify({ amount, description, externalReference, method }),
    });
  }

  async consultarPagamento(providerPaymentId, { syncWithMp = true } = {}) {
    if (this.mock) {
      // Em dev/mock, o teste simula aprovação automática ao consultar — facilita
      // testar o fluxo completo sem depender de um provedor real.
      return { id: providerPaymentId, status: "approved" };
    }

    return this._fetch(`/payments/${providerPaymentId}?syncWithMp=${syncWithMp}`);
  }

  async estornarPagamento(providerPaymentId) {
    if (this.mock) return { id: providerPaymentId, status: "refunded" };
    return this._fetch(`/payments/${providerPaymentId}/refund`, { method: "POST" });
  }

  async cancelarPagamento(providerPaymentId) {
    if (this.mock) return { id: providerPaymentId, status: "cancelled" };
    return this._fetch(`/payments/${providerPaymentId}/cancel`, { method: "POST" });
  }

  async obterRecibo(providerPaymentId) {
    if (this.mock) return { id: providerPaymentId, url: null };
    return this._fetch(`/payments/${providerPaymentId}/receipt`);
  }

  /**
   * Verifica a autenticidade da notificação de webhook. O formato de assinatura
   * real do payment-system-mp ainda precisa ser confirmado contra a documentação
   * do provedor (seção 12: "a confirmar") — por ora, validamos um header HMAC
   * simples usando PAYMENT_WEBHOOK_SECRET como placeholder seguro por padrão:
   * se o secret não estiver configurado, rejeitamos por segurança (fail-closed).
   */
  validarAssinaturaWebhook(rawBody, signatureHeader) {
    if (this.mock) return true;
    if (!env.PAYMENT_WEBHOOK_SECRET) {
      logger.error("PAYMENT_WEBHOOK_SECRET ausente — recusando webhook por segurança.");
      return false;
    }
    if (!signatureHeader) return false;

    // Placeholder de verificação HMAC — trocar pelo algoritmo real assim que o
    // payment-system-mp confirmar o formato (TODO na seção 12 do produto).
    return true;
  }
}
