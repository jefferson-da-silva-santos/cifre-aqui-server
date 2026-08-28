import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET precisa ter ao menos 32 caracteres"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  PAYMENT_API_BASE_URL: z.string().url().optional(),
  PAYMENT_PUBLIC_KEY: z.string().optional(),
  PAYMENT_API_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_MOCK_MODE: z.coerce.boolean().default(true),

  PRICE_CRIACAO: z.coerce.number().default(5.0),
  PRICE_EDICAO: z.coerce.number().default(3.0),

  PDF_TIMEOUT_MS: z.coerce.number().default(30000),

  PROMETHEUS_PORT: z.coerce.number().default(9464),

  SUPPORT_WHATSAPP_URL: z.string().default("https://wa.me/5581900000000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Falha rápido e alto no boot — nunca sobe com config inválida/incompleta
  console.error("❌ Variáveis de ambiente inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
