import { desc, eq, isNull, sql as dsql } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client.js";
import { auditEvents } from "../db/schema.js";
import { sha256 } from "./crypto.js";

/** JSON canónico (chaves ordenadas) — o jsonb do PostgreSQL reordena chaves. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonicalJson(o[k])).join(",") + "}";
}

export type AuditInput = {
  tenantId: string | null;
  actorType: "user" | "platform_admin" | "system" | "ai";
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  traceId?: string | null;
};

/**
 * Regista um evento de auditoria encadeado por hash (por tenant): cada registo
 * guarda o hash do anterior, o que permite detetar alteração ou remoção indevida
 * (ver verifyAuditChain). A tabela é só de inserção na aplicação.
 */
export async function audit(input: AuditInput, tx: DbOrTx = db) {
  const run = async (t: DbOrTx) => {
    const chainKey = input.tenantId ?? "platform";
    await t.execute(dsql`select pg_advisory_xact_lock(hashtext(${"audit:" + chainKey}))`);
    const [last] = await t
      .select({ hash: auditEvents.hash })
      .from(auditEvents)
      .where(input.tenantId ? eq(auditEvents.tenantId, input.tenantId) : isNull(auditEvents.tenantId))
      .orderBy(desc(auditEvents.id))
      .limit(1);
    const prevHash = last?.hash ?? null;
    const createdAt = new Date();
    const body = {
      tenantId: input.tenantId,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: JSON.parse(JSON.stringify(input.metadata ?? {})) as Record<string, unknown>,
      createdAt: createdAt.toISOString(),
    };
    const hash = sha256((prevHash ?? "") + canonicalJson(body));
    await t.insert(auditEvents).values({ ...body, createdAt, ip: input.ip ?? null, traceId: input.traceId ?? null, prevHash, hash });
  };
  // Se já estamos numa transação, usamo-la; caso contrário abrimos uma.
  if (tx === db) await db.transaction(run);
  else await run(tx);
}

/** Recalcula a cadeia de hashes de um tenant; devolve o id do primeiro registo inconsistente ou null. */
export async function verifyAuditChain(tenantId: string | null): Promise<number | null> {
  const rows = await db
    .select()
    .from(auditEvents)
    .where(tenantId ? eq(auditEvents.tenantId, tenantId) : isNull(auditEvents.tenantId))
    .orderBy(auditEvents.id);
  let prev: string | null = null;
  for (const r of rows) {
    const body = {
      tenantId: r.tenantId,
      actorType: r.actorType,
      actorId: r.actorId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      summary: r.summary,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    };
    if (r.prevHash !== prev || r.hash !== sha256((prev ?? "") + canonicalJson(body))) return r.id;
    prev = r.hash;
  }
  return null;
}
