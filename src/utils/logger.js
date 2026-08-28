import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: [
    "req.headers.authorization",
    "body.password",
    "body.senha",
    "body.token",
    "*.senhaHash",
    "*.tokenHash",
  ],
  formatters: { level: (label) => ({ level: label }) },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
});
