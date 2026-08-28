import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import { corsOrigins } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { requestId } from "./middlewares/requestId.js";
import { sanitizeBody } from "./middlewares/sanitize.js";
import { globalRateLimiter } from "./middlewares/rateLimiter.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import cifraRoutes from "./routes/cifra.routes.js";
import acordeCustomizadoRoutes from "./routes/acordeCustomizado.routes.js";
import pagamentoRoutes from "./routes/pagamento.routes.js";
import apostilaRoutes from "./routes/apostila.routes.js";
import downloadRoutes from "./routes/download.routes.js";
import configRoutes from "./routes/config.routes.js";
import exportsRoutes from "./routes/exports.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

export default function createApp(prisma, container) {
  const app = express();
  const { controllers } = container;

  app.disable("x-powered-by");

  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  // Guarda o corpo bruto (necessário para validar assinatura de webhook) antes
  // do parse JSON, só na rota de webhook.
  app.use(
    "/pagamentos/webhook",
    express.raw({ type: "*/*" }),
    (req, res, next) => {
      req.rawBody = req.body;
      try {
        req.body = req.body?.length ? JSON.parse(req.body.toString("utf8")) : {};
      } catch {
        req.body = {};
      }
      next();
    },
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(sanitizeBody);
  app.use(globalRateLimiter);
  app.use(pinoHttp({ logger, customLogLevel: (req, res) => (res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info") }));

  app.use("/health", healthRoutes(prisma));
  app.use("/auth", authRoutes(controllers));
  app.use("/cifras", cifraRoutes(controllers));
  app.use("/acordes-customizados", acordeCustomizadoRoutes(controllers));
  app.use("/pagamentos", pagamentoRoutes(controllers));
  app.use("/apostilas", apostilaRoutes(controllers));
  app.use("/downloads", downloadRoutes());
  app.use("/config", configRoutes(controllers));
  app.use("/exports", exportsRoutes(controllers));
  app.use("/dashboard", dashboardRoutes(controllers));

  app.use(notFound); // sempre depois das rotas
  app.use(errorHandler); // sempre por último

  return app;
}
