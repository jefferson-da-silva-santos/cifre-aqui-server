import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { pdfRateLimiter } from "../middlewares/rateLimiter.js";
import {
  schemaCreateCifra,
  schemaUpdateCifra,
  schemaTransporCifra,
  schemaListCifras,
  schemaIniciarExportacao,
  schemaExportarCifra,
} from "../utils/validations.js";

export default function cifraRoutes(deps) {
  const router = Router();
  const { cifraController, exportacaoController } = deps;

  router.use(auth);

  router.post("/", validate(schemaCreateCifra), cifraController.criar);
  router.get("/", validate(schemaListCifras, "query"), cifraController.listar);
  router.get("/:id", cifraController.obter);
  router.patch("/:id", validate(schemaUpdateCifra), cifraController.atualizar);
  router.delete("/:id", cifraController.excluir);

  router.post("/:id/transposicao", validate(schemaTransporCifra), cifraController.transpor);
  router.post("/:id/duplicate", cifraController.duplicar);

  // Exportação/pagamento — aninhado por semântica de recurso (cifra -> exportação)
  router.post(
    "/:id/exportacoes",
    pdfRateLimiter,
    validate(schemaIniciarExportacao),
    exportacaoController.iniciar,
  );

  // Variantes consumidas pelo frontend (orçamento sem efeito colateral +
  // job de exportação com polling em /exports/:exportId).
  router.get("/:id/export-quote", exportacaoController.orcar);
  router.post(
    "/:id/export",
    pdfRateLimiter,
    validate(schemaExportarCifra),
    exportacaoController.exportar,
  );

  return router;
}
