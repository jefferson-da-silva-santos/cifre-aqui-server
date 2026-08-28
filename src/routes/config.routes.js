import { Router } from "express";

export default function configRoutes(deps) {
  const router = Router();
  const { configController } = deps;

  // Pública — o front consulta antes mesmo de o usuário estar logado
  // (ex.: link de WhatsApp de suporte na tela de login).
  router.get("/", configController.obter);

  return router;
}
