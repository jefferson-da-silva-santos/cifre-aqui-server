import { env } from "./config/env.js";
import { createPrismaClient } from "./config/database.js";
import { logger } from "./utils/logger.js";
import { iniciarObservabilidade, pararObservabilidade } from "./observability/tracing.js";
import { buildContainer } from "./container.js";
import createApp from "./app.js";

iniciarObservabilidade();

const prisma = createPrismaClient();
const container = buildContainer(prisma);
const app = createApp(prisma, container);

const server = app.listen(env.PORT, () => {
  logger.info(`🎸 CifreAqui backend rodando na porta ${env.PORT} [${env.NODE_ENV}]`);
});

async function shutdown(signal) {
  logger.info(`${signal} recebido, iniciando graceful shutdown...`);

  server.close(async () => {
    logger.info("Servidor HTTP fechado.");
    try {
      await container.pdfService.fechar();
      logger.info("Instância do Puppeteer encerrada.");
    } catch (err) {
      logger.warn({ err }, "Falha ao encerrar Puppeteer.");
    }
    await prisma.$disconnect();
    logger.info("Conexão com o banco encerrada.");
    await pararObservabilidade();
    process.exit(0);
  });

  // Failsafe: força encerramento se demorar demais
  setTimeout(() => {
    logger.error("Shutdown forçado após timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
