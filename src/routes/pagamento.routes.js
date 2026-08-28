import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { schemaWebhookPagamento } from "../utils/validations.js";

export default function pagamentoRoutes(deps) {
  const router = Router();
  const { pagamentoController, exportacaoController } = deps;

  // Rotas públicas do contrato do widget (seção 12) — a autenticação da
  // notificação de webhook é feita por assinatura, não por sessão de usuário.
  router.get("/config", pagamentoController.config);
  router.post("/webhook", validate(schemaWebhookPagamento), pagamentoController.webhook);

  // Rotas autenticadas do usuário
  router.use(auth);
  router.get("/", pagamentoController.listar);
  router.get("/:pagamentoId/status", exportacaoController.status);
  router.post("/:pagamentoId/reprocessar-pdf", exportacaoController.reprocessar);
  router.post("/:id/refund", pagamentoController.estornar);
  router.post("/:id/cancel", pagamentoController.cancelar);
  router.get("/:id/receipt", pagamentoController.recibo);

  return router;
}
