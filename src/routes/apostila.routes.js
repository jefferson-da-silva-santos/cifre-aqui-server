import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { pdfRateLimiter } from "../middlewares/rateLimiter.js";
import { schemaCreateApostila, schemaOrcarApostila } from "../utils/validations.js";

export default function apostilaRoutes(deps) {
  const router = Router();
  const { apostilaController } = deps;

  router.use(auth);

  router.post("/", pdfRateLimiter, validate(schemaCreateApostila), apostilaController.criar);
  // Alias usado pelo frontend, mesmo comportamento de POST /apostilas.
  router.post("/export", pdfRateLimiter, validate(schemaCreateApostila), apostilaController.criar);
  router.post("/quote", validate(schemaOrcarApostila), apostilaController.orcar);
  router.get("/:id/pdf", apostilaController.baixar);

  return router;
}
