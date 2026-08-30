import pino from "pino";
import { env } from "../config/env.js";

const isProduction = env.NODE_ENV === "production";

function buildTransport() {
  // Nunca tenta usar pino-pretty em produção (worker thread não resolve
  // o módulo corretamente em bundles serverless/Lambda).
  if (isProduction) return undefined;

  try {
    // Garante que só tentamos usar pino-pretty se ele realmente
    // estiver resolvível no ambiente atual.
    require.resolve("pino-pretty");
    return {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss" },
    };
  } catch {
    // pino-pretty não disponível (ex: rodando em ambiente empacotado) — 
    // cai para log JSON puro em vez de derrubar o processo.
    return undefined;
  }
}

export const logger = pino({
  level: isProduction ? "info" : "debug",
  redact: [
    "req.headers.authorization",
    "body.password",
    "body.senha",
    "body.token",
    "*.senhaHash",
    "*.tokenHash",
  ],
  formatters: { level: (label) => ({ level: label }) },
  transport: buildTransport(),
});