import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db, sql } from "./client.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  await migrate(db, { migrationsFolder: path.resolve(here, "../../drizzle") });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(() => console.log("Migrations aplicadas."))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => sql.end());
}
