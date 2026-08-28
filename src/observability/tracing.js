import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let sdk;

export function iniciarObservabilidade() {
  try {
    sdk = new NodeSDK({
      metricReader: new PrometheusExporter({ port: env.PROMETHEUS_PORT }),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
    logger.info(`Observabilidade (Prometheus) ativa na porta ${env.PROMETHEUS_PORT}`);
  } catch (err) {
    logger.warn({ err }, "Falha ao iniciar observabilidade — seguindo sem métricas.");
  }
}

export async function pararObservabilidade() {
  if (sdk) await sdk.shutdown().catch(() => {});
}
