import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  logger.error(
    { err, requestId: req.id, path: req.originalUrl, method: req.method },
    err.message,
  );

  res.status(status).json({
    success: false,
    message: status === 500 ? "Erro interno do servidor." : err.message,
    details: err.details ?? undefined,
    requestId: req.id,
    ...(env.NODE_ENV !== "production" && status === 500 ? { stack: err.stack } : {}),
  });
}
