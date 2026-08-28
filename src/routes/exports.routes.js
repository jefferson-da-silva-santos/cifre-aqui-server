import { Router } from "express";
import { auth } from "../middlewares/auth.js";

// GET /exports/:exportId — polling consumido pelo frontend após POST /cifras/:id/export
// retornar um job em "aguardando_pagamento". `exportId` aqui é o id do Pagamento.
export default function exportsRoutes(deps) {
  const router = Router();
  const { exportacaoController } = deps;

  router.use(auth);
  router.get("/:exportId", exportacaoController.statusExportacao);

  return router;
}
