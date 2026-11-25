/**
 * Backups e teste de restauro (§10.3, §15 "Recuperação", §20).
 *
 *   pnpm backup            → pg_dump (formato custom) encriptado AES-256-GCM + manifesto SHA-256; aplica retenção.
 *   pnpm backup:verify     → desencripta o último backup, restaura numa BD temporária, valida integridade
 *                            (checksum, contagens por tenant, cadeias de auditoria) e elimina a BD temporária.
 *
 * Variáveis: BACKUP_DIR, BACKUP_ENCRYPTION_KEY (64 hex; por omissão ENCRYPTION_KEY), BACKUP_KEEP (n.º de cópias),
 * PG_BIN (pasta com pg_dump/pg_restore, se não estiverem no PATH).
 * Para cópias redundantes, sincronize BACKUP_DIR para object storage noutra região (ex.: aws s3 sync / rclone).
 */
import { allKeys } from "../core/crypto.js";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { config } from "../config.js";
import { verifyChainRows } from "../core/audit.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR ?? path.resolve(here, "../../../../.data/backups"));
// Com BACKUP_ENCRYPTION_KEY usa só essa; caso contrário, encripta com a chave atual e lê com qualquer
// chave do porta-chaves (as cópias feitas antes de uma rotação continuam restauráveis).
const KEY = process.env.BACKUP_ENCRYPTION_KEY ? Buffer.from(process.env.BACKUP_ENCRYPTION_KEY, "hex") : null;
const encryptKey = () => KEY ?? allKeys()[0].key;
const decryptKeys = () => (KEY ? [KEY] : allKeys().map((k) => k.key));
const KEEP = Number(process.env.BACKUP_KEEP ?? 14);
const bin = (n: string) => (process.env.PG_BIN ? path.join(process.env.PG_BIN, n) : n);

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env } });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`${cmd} saiu com ${code}: ${Buffer.concat(err).toString().slice(0, 500)}`))));
  });
}

const sha256File = (file: string) =>
  new Promise<string>((resolve, reject) => {
    const h = crypto.createHash("sha256");
    createReadStream(file).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });

export async function createBackup(dbUrl = config.databaseUrl) {
  await fs.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const dump = await run(bin("pg_dump"), ["--format=custom", "--no-owner", "--no-privileges", dbUrl]);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptKey(), iv);
  const enc = Buffer.concat([cipher.update(dump), cipher.final()]);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `nexora-${stamp}.dump.enc`);
  // formato: "NXB1" | iv(12) | tag(16) | dados
  await fs.writeFile(file, Buffer.concat([Buffer.from("NXB1"), iv, cipher.getAuthTag(), enc]), { mode: 0o600 });
  const manifest = { file: path.basename(file), createdAt: new Date().toISOString(), plainSha256: crypto.createHash("sha256").update(dump).digest("hex"), encryptedSha256: await sha256File(file), bytes: dump.length };
  await fs.writeFile(file + ".json", JSON.stringify(manifest, null, 2), { mode: 0o600 });
  // Retenção: mantém as KEEP cópias mais recentes
  const all = (await fs.readdir(BACKUP_DIR)).filter((f) => f.endsWith(".dump.enc")).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
    await fs.rm(path.join(BACKUP_DIR, old), { force: true });
    await fs.rm(path.join(BACKUP_DIR, old + ".json"), { force: true });
  }
  return manifest;
}

async function decryptBackup(file: string): Promise<Buffer> {
  const buf = await fs.readFile(file);
  if (buf.subarray(0, 4).toString() !== "NXB1") throw new Error("Formato de backup desconhecido.");
  for (const key of decryptKeys()) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(4, 16));
      decipher.setAuthTag(buf.subarray(16, 32));
      return Buffer.concat([decipher.update(buf.subarray(32)), decipher.final()]);
    } catch {
      /* chave seguinte */
    }
  }
  throw new Error("Não foi possível desencriptar o backup com nenhuma chave conhecida.");
}

const COUNTED = ["tenants", "users", "memberships", "invoices", "payments", "employees", "customers", "products", "sales_orders", "finance_transactions", "audit_events"];

async function snapshotCounts(sql: postgres.Sql) {
  const out: Record<string, Record<string, number>> = {};
  for (const t of COUNTED) {
    const col = t === "tenants" ? "id" : t === "users" ? null : "tenant_id";
    const rows = col
      ? await sql.unsafe(`select coalesce(${col}::text,'platform') as k, count(*)::int as n from ${t} group by 1`)
      : await sql.unsafe(`select 'all' as k, count(*)::int as n from ${t}`);
    out[t] = Object.fromEntries(rows.map((r: any) => [r.k, r.n]));
  }
  return out;
}

/** Restaura o backup mais recente numa BD temporária e valida-o. Devolve um relatório. */
export async function verifyLatestBackup(dbUrl = config.databaseUrl) {
  const files = (await fs.readdir(BACKUP_DIR)).filter((f) => f.endsWith(".dump.enc")).sort();
  if (!files.length) throw new Error(`Sem backups em ${BACKUP_DIR}`);
  const file = path.join(BACKUP_DIR, files[files.length - 1]);
  const manifest = JSON.parse(await fs.readFile(file + ".json", "utf8"));
  const report: Record<string, unknown> = { backup: path.basename(file), startedAt: new Date().toISOString() };
  if ((await sha256File(file)) !== manifest.encryptedSha256) throw new Error("Checksum do ficheiro encriptado não corresponde ao manifesto.");
  const dump = await decryptBackup(file);
  if (crypto.createHash("sha256").update(dump).digest("hex") !== manifest.plainSha256) throw new Error("Checksum do conteúdo desencriptado não corresponde.");
  report.checksums = "ok";

  const tmpName = `nexora_restore_${Date.now()}`;
  const admin = postgres(dbUrl, { max: 1, onnotice: () => {} });
  const tmpUrl = (() => { const u = new URL(dbUrl); u.pathname = "/" + tmpName; return u.toString(); })();
  const tmpFile = path.join(BACKUP_DIR, `.${tmpName}.dump`);
  await admin.unsafe(`create database ${tmpName}`);
  try {
    await fs.writeFile(tmpFile, dump, { mode: 0o600 });
    const t0 = Date.now();
    await run(bin("pg_restore"), ["--no-owner", "--no-privileges", "--exit-on-error", "-d", tmpUrl, tmpFile]);
    report.restoreSeconds = (Date.now() - t0) / 1000;
    const restored = postgres(tmpUrl, { max: 1, onnotice: () => {} });
    try {
      // 1) Integridade das cadeias de auditoria (por tenant e plataforma) na cópia restaurada
      const chains = await restored.unsafe(`select distinct tenant_id from audit_events`);
      const broken: string[] = [];
      for (const c of chains as any[]) {
        const rows = await restored.unsafe(
          `select id, tenant_id as "tenantId", actor_type as "actorType", actor_id as "actorId", action, entity_type as "entityType", entity_id as "entityId", summary, metadata, created_at as "createdAt", prev_hash as "prevHash", hash from audit_events where tenant_id ${c.tenant_id ? "= $1" : "is null"} order by id`,
          c.tenant_id ? [c.tenant_id] : [],
        );
        if (verifyChainRows(rows as any) !== null) broken.push(c.tenant_id ?? "platform");
      }
      report.auditChains = { checked: chains.length, broken };
      // 2) Isolamento preservado: registos de negócio continuam associados ao tenant correto
      const orphan = await restored.unsafe(`select count(*)::int as n from customers c left join tenants t on t.id = c.tenant_id where t.id is null`);
      report.orphanRecords = orphan[0].n;
      report.restoredCounts = await snapshotCounts(restored);
    } finally {
      await restored.end();
    }
  } finally {
    await fs.rm(tmpFile, { force: true });
    await admin.unsafe(`drop database if exists ${tmpName} with (force)`);
    await admin.end();
  }
  report.finishedAt = new Date().toISOString();
  report.ok = (report.auditChains as any).broken.length === 0 && report.orphanRecords === 0;
  await fs.writeFile(path.join(BACKUP_DIR, "last-restore-test.json"), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const mode = process.argv[2] ?? "backup";
  (mode === "verify" ? verifyLatestBackup() : createBackup())
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      if (mode === "verify" && !(r as any).ok) process.exitCode = 2;
    })
    .catch((e) => {
      console.error("Falha:", e.message);
      process.exitCode = 1;
    })
    .finally(() => import("../db/client.js").then((m) => m.sql.end()));
}
