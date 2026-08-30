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

  /*
   * Cookie de refresh.
   *
   * `lax` serve desenvolvimento e produção com frontend e API no mesmo site
   * (a porta não conta para cookies, então localhost:5173 e localhost:3000 são
   * o mesmo site). Domínios diferentes exigem `none`, que por sua vez exige
   * HTTPS dos dois lados — o cookie é forçado a `secure` nesse caso.
   */
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: z.string().optional(),

  PAYMENT_API_BASE_URL: z.string().url().optional(),
  PAYMENT_PUBLIC_KEY: z.string().optional(),
  PAYMENT_API_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_MOCK_MODE: z.coerce.boolean().default(true),

  PRICE_CRIACAO: z.coerce.number().default(5.0),
  PRICE_EDICAO: z.coerce.number().default(3.0),

  PDF_TIMEOUT_MS: z.coerce.number().default(30000),

  /*
   * Caminho do Chrome/Chromium para o Puppeteer.
   *
   * Vazio significa "use o binário que o puppeteer baixou". Instalações com
   * `puppeteer-core`, ou com `PUPPETEER_SKIP_DOWNLOAD`, não têm binário nenhum —
   * é daí que vem o "Could not find Chrome". Nesses casos aponte aqui para um
   * Chrome já instalado na máquina ou na imagem Docker.
   */
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),

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

/** Duração do cookie de refresh, derivada do próprio JWT_REFRESH_EXPIRES_IN. */
export const refreshCookieMaxAgeMs = (() => {
  const m = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN.trim());
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const fator = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]];
  return Number(m[1]) * fator;
})();
env.REFRESH_COOKIE_MAX_AGE_MS = refreshCookieMaxAgeMs;
export const corsOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
