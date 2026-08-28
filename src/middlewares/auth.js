import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

// Popula req.user = { id } a partir do access token.
// O restante do sistema sempre relê dados sensíveis do banco quando necessário —
// nunca confia em campos extras que um token antigo possa carregar.
export function auth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return next(ApiError.unauthorized("Token de acesso ausente."));

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch {
    next(ApiError.unauthorized("Token inválido ou expirado."));
  }
}
