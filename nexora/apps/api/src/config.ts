import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
// .env vive na raiz do monorepo (nexora/.env)
loadEnv({ path: path.resolve(here, "../../../.env") });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`Variável de ambiente em falta: ${name}`);
  return v;
}

const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

export const config = {
  env: process.env.NODE_ENV ?? "development",
  isTest,
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.API_PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  publicApiUrl: process.env.PUBLIC_API_URL ?? "http://localhost:4000",
  databaseUrl: isTest
    ? required("TEST_DATABASE_URL", "postgres://postgres:postgres@localhost:5432/nexora_test")
    : required("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/nexora"),
  encryptionKey: required("ENCRYPTION_KEY", isTest ? "1".repeat(64) : undefined),
  /** Chaves anteriores (64 hex, separadas por vírgulas), só para ler dados encriptados antes da rotação. */
  previousEncryptionKeys: (process.env.ENCRYPTION_KEYS_PREVIOUS ?? "").split(",").map((k) => k.trim()).filter(Boolean),
  paymentWebhookSecret: required("PAYMENT_WEBHOOK_SECRET", isTest ? "test-webhook-secret" : undefined),
  aiProvider: process.env.AI_PROVIDER ?? "local",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
  mailTransport: process.env.MAIL_TRANSPORT ?? "console",
  sessionTtlHours: 24 * 7,
  /** RLS do PostgreSQL: "auto" (ativa se for possível criar o papel), "required" (falha se não for) ou "off". */
  dbRls: (process.env.DB_RLS ?? "auto") as "auto" | "required" | "off",
  dbPoolMax: Number(process.env.DB_POOL_MAX ?? 20),
};
