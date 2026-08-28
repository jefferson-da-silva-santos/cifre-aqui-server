import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";

function onLimitReached(message) {
  return (req, res, next, options) => {
    next(new ApiError(429, message));
  };
}

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: onLimitReached("Muitas requisições. Tente novamente em alguns minutos."),
});

// Mais agressivo em login/refresh/register — alvo comum de força bruta
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: onLimitReached("Muitas tentativas de autenticação. Tente novamente em alguns minutos."),
});

// PDF é caro (Puppeteer) — protege contra abuso de exportação
export const pdfRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: onLimitReached("Muitas exportações em pouco tempo. Aguarde um instante."),
});
