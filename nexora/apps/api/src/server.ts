import "./observability/tracing-init.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { seedPlatform } from "./db/seed.js";
import { runAllJobs } from "./jobs/jobs.js";

await runMigrations();
await seedPlatform();
const app = await buildApp();
await app.listen({ port: config.port, host: "0.0.0.0" });

// Em desenvolvimento o worker corre no mesmo processo; em produção use `pnpm worker`.
if (!config.isProd && process.env.DISABLE_INPROCESS_JOBS !== "1") {
  setInterval(() => runAllJobs().catch((e) => app.log.error(e)), 10 * 60_000).unref();
}
