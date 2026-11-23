import postgres from "postgres";

/** Recria o schema da base de testes e aplica migrations + seeds de plataforma. */
export default async function setup() {
  process.env.NODE_ENV = "test";
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/nexora_test";
  const sql = postgres(url, { onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await sql.end();
  const { runMigrations } = await import("../db/migrate.js");
  const { seedPlatform } = await import("../db/seed.js");
  const { sql: client } = await import("../db/client.js");
  await runMigrations();
  await seedPlatform();
  await client.end();
}
