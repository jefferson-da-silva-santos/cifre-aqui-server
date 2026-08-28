import { Router } from "express";
import path from "path";
import { existsSync } from "fs";
import { auth } from "../middlewares/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const OUTPUT_DIR = path.resolve(process.cwd(), "storage", "pdfs");
// Nomes de arquivo são gerados internamente (uuid/timestamp) — ainda assim
// validamos contra path traversal antes de servir.
const NOME_ARQUIVO_SEGURO = /^[a-zA-Z0-9._-]+\.pdf$/;

export default function downloadRoutes() {
  const router = Router();

  router.get(
    "/pdfs/:fileName",
    auth,
    asyncHandler(async (req, res) => {
      const { fileName } = req.params;
      if (!NOME_ARQUIVO_SEGURO.test(fileName)) {
        throw ApiError.badRequest("Nome de arquivo inválido.");
      }

      const filePath = path.join(OUTPUT_DIR, fileName);
      if (!filePath.startsWith(OUTPUT_DIR) || !existsSync(filePath)) {
        throw ApiError.notFound("Arquivo não encontrado ou expirado.");
      }

      res.download(filePath, fileName);
    }),
  );

  return router;
}
