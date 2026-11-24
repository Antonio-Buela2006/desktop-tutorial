/** Notificações, auditoria, lixeira (área recuperável), exportação e acesso de suporte. */
import { localizeNotification } from "../core/notify.js";
import type { FastifyInstance } from "fastify";
import { and, count, desc, eq, gt, ilike, isNotNull, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  auditEvents,
  customers,
  employees,
  exportJobs,
  financeTransactions,
  notifications,
  products,
  salesOrders,
  stockMovements,
  supportAccessGrants,
} from "../db/schema.js";
import { audit, verifyAuditChain } from "../core/audit.js";
import { auditBase, authorize, branchCondition, can, requireCtx, type Ctx } from "../core/context.js";
import { randomToken, sha256 } from "../core/crypto.js";
import { badRequest, forbidden, notFound } from "../core/errors.js";
import { pageQuery, parse, toCsv, uuidParam } from "../core/http.js";
import { MODULE_DATASETS } from "../core/permissions.js";
import { buildReportPdf, buildXlsx } from "../core/documents.js";

const TRASH_TABLES = {
  customers: { table: customers, perm: "crm.delete", label: (r: any) => r.name },
  products: { table: products, perm: "inventory.delete", label: (r: any) => `${r.sku} · ${r.name}` },
  employees: { table: employees, perm: "employees.delete", label: (r: any) => r.fullName },
  finance_transactions: { table: financeTransactions, perm: "finance.delete", label: (r: any) => `${r.category} · ${r.amount}` },
} as const;

const DATASET_TABLES: Record<string, any> = {
  customers,
  products,
  stock_movements: stockMovements,
  sales_orders: salesOrders,
  finance_transactions: financeTransactions,
  employees,
};

async function datasetRows(ctx: Ctx, dataset: string) {
  const t = DATASET_TABLES[dataset];
  const conds = [eq(t.tenantId, ctx.tenant.id)];
  if (t.deletedAt) conds.push(isNull(t.deletedAt));
  // Âmbito por unidade nos conjuntos que têm unidade
  if (t.branchId) {
    const c = branchCondition(ctx, t.branchId);
    if (c) conds.push(c);
  }
  let rows: Record<string, unknown>[] = await db.select().from(t).where(and(...conds));
  if (dataset === "employees" && !can(ctx, "employees.view_salary")) rows = rows.map(({ salary: _s, ...r }) => r);
  return rows.map(({ tenantId: _t, ...r }) => r);
}

export async function governanceRoutes(app: FastifyInstance) {
  /* ---------------- Notificações ---------------- */
  app.get("/api/notifications", async (req) => {
    const ctx = requireCtx(req);
    const rows = await db.select().from(notifications).where(and(eq(notifications.tenantId, ctx.tenant.id), eq(notifications.membershipId, ctx.membership.id))).orderBy(desc(notifications.createdAt)).limit(100);
    return { items: rows.map((r) => localizeNotification(r, ctx.user.locale)), unread: rows.filter((r) => !r.readAt).length };
  });

  app.post("/api/notifications/read", async (req) => {
    const ctx = requireCtx(req);
    const { ids } = parse(z.object({ ids: z.array(z.string().uuid()).max(200).optional() }), req.body ?? {});
    const base = and(eq(notifications.tenantId, ctx.tenant.id), eq(notifications.membershipId, ctx.membership.id), isNull(notifications.readAt));
    const rows = await db.update(notifications).set({ readAt: new Date() }).where(base).returning({ id: notifications.id });
    void ids;
    return { updated: rows.length };
  });

  /* ---------------- Auditoria ---------------- */
  app.get("/api/audit", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "audit.view");
    const q = parse(pageQuery.extend({ actorType: z.enum(["user", "system", "ai", "platform_admin"]).optional() }), req.query);
    const where = and(
      eq(auditEvents.tenantId, ctx.tenant.id),
      q.actorType ? eq(auditEvents.actorType, q.actorType) : undefined,
      q.q ? or(ilike(auditEvents.summary, `%${q.q}%`), ilike(auditEvents.action, `%${q.q}%`)) : undefined,
    );
    const items = await db.select().from(auditEvents).where(where).orderBy(desc(auditEvents.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const [{ n }] = await db.select({ n: count() }).from(auditEvents).where(where);
    return { items, total: n };
  });

  app.get("/api/audit/verify", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "audit.view");
    const broken = await verifyAuditChain(ctx.tenant.id);
    return { intact: broken === null, firstInconsistentId: broken };
  });

  /* ---------------- Lixeira (eliminação recuperável) ---------------- */
  app.get("/api/trash", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "trash.manage", "read");
    const retention = ctx.tenant.settings.trashRetentionDays ?? 30;
    const out: { type: string; id: string; label: string; deletedAt: Date; purgeAt: Date }[] = [];
    for (const [type, def] of Object.entries(TRASH_TABLES)) {
      if (!can(ctx, def.perm)) continue;
      const t: any = def.table;
      const rows = await db.select().from(t).where(and(eq(t.tenantId, ctx.tenant.id), isNotNull(t.deletedAt)));
      for (const r of rows as any[]) out.push({ type, id: r.id, label: def.label(r), deletedAt: r.deletedAt, purgeAt: new Date(r.deletedAt.getTime() + retention * 86400_000) });
    }
    return out.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  });

  app.post("/api/trash/:type/:id/restore", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "trash.manage");
    const { type, id } = parse(z.object({ type: z.enum(Object.keys(TRASH_TABLES) as [keyof typeof TRASH_TABLES]), id: z.string().uuid() }), req.params);
    const def = TRASH_TABLES[type];
    if (!can(ctx, def.perm)) throw forbidden();
    const t: any = def.table;
    const r = await db.update(t).set({ deletedAt: null }).where(and(eq(t.id, id), eq(t.tenantId, ctx.tenant.id), isNotNull(t.deletedAt))).returning({ id: t.id });
    if (!r.length) throw notFound();
    await audit({ ...auditBase(ctx), action: "trash.restored", entityType: type, entityId: id, summary: `Registo restaurado da lixeira (${type}).` });
    return { ok: true };
  });

  /* ---------------- Exportação de dados (por módulo e global) ---------------- */
  app.post("/api/exports", async (req) => {
    const ctx = requireCtx(req);
    const body = parse(z.object({ scope: z.string().max(40), format: z.enum(["csv", "json", "xlsx", "pdf"]) }), req.body);
    if (!ctx.caps.export) throw forbidden("A exportação não está disponível no estado atual da subscrição.", "SUBSCRIPTION_SUSPENDED");
    const moduleKeys = body.scope === "all" ? Object.keys(MODULE_DATASETS) : [body.scope];
    const datasets: string[] = [];
    for (const mk of moduleKeys) {
      const defs = MODULE_DATASETS[mk];
      if (!defs) throw badRequest("Âmbito de exportação inválido.");
      if (mk !== "core" && !ctx.modules.has(mk) && body.scope !== "all") throw forbidden("Módulo não contratado.", "MODULE_NOT_CONTRACTED");
      // Exportação inclui apenas o que o solicitante pode exportar.
      for (const d of defs) if (ctx.permissions.has(d.exportPerm) && (mk === "core" || ctx.modules.has(mk))) datasets.push(d.dataset);
    }
    if (!datasets.length) throw forbidden("Não tem permissão para exportar este âmbito.");
    let content: string;
    let contentType: string;
    let fileName: string;
    let encoding = "utf8";
    const stamp = new Date().toISOString().slice(0, 10);
    if (body.format === "xlsx" || body.format === "pdf") {
      const data: Record<string, Record<string, unknown>[]> = {};
      for (const d of datasets) data[d] = await datasetRows(ctx, d);
      const meta = { company: ctx.tenant.name, exportedAt: new Date().toISOString() };
      const buf = body.format === "xlsx" ? await buildXlsx(data, meta) : await buildReportPdf(data, meta);
      content = buf.toString("base64");
      encoding = "base64";
      contentType = body.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf";
      fileName = `nexora-${body.scope}-${stamp}.${body.format}`;
    } else if (body.format === "json" || datasets.length > 1) {
      const pkg: Record<string, unknown> = { exportedAt: new Date().toISOString(), company: ctx.tenant.name, scope: body.scope, datasets: {} };
      for (const d of datasets) (pkg.datasets as any)[d] = await datasetRows(ctx, d);
      content = JSON.stringify(pkg, null, 2);
      contentType = "application/json";
      fileName = `nexora-${body.scope}-${stamp}.json`;
    } else {
      content = toCsv(await datasetRows(ctx, datasets[0]));
      contentType = "text/csv; charset=utf-8";
      fileName = `nexora-${datasets[0]}-${stamp}.csv`;
    }
    const token = randomToken();
    const [job] = await db
      .insert(exportJobs)
      .values({ tenantId: ctx.tenant.id, requestedBy: ctx.membership.id, scope: body.scope, format: body.format, datasets, tokenHash: sha256(token), content, contentType, encoding, fileName, expiresAt: new Date(Date.now() + 15 * 60_000) })
      .returning({ id: exportJobs.id });
    await audit({ ...auditBase(ctx), action: "export.created", entityType: "export", entityId: job.id, summary: `Exportação ${body.format.toUpperCase()} (${datasets.join(", ")}).` });
    return { id: job.id, datasets, downloadUrl: `/api/exports/download/${token}`, expiresInMinutes: 15 };
  });

  /** Link temporário (15 min), associado ao utilizador que pediu. */
  app.get("/api/exports/download/:token", async (req, reply) => {
    const ctx = requireCtx(req);
    const { token } = parse(z.object({ token: z.string().min(10) }), req.params);
    const [job] = await db.select().from(exportJobs).where(and(eq(exportJobs.tokenHash, sha256(token)), eq(exportJobs.tenantId, ctx.tenant.id), eq(exportJobs.requestedBy, ctx.membership.id), gt(exportJobs.expiresAt, new Date())));
    if (!job) throw notFound("Link de exportação inválido ou expirado.");
    await db.update(exportJobs).set({ downloadedAt: new Date() }).where(eq(exportJobs.id, job.id));
    reply.header("content-type", job.contentType).header("content-disposition", `attachment; filename="${job.fileName}"`).header("cache-control", "private, no-store");
    return job.encoding === "base64" ? Buffer.from(job.content, "base64") : job.content;
  });

  /* ---------------- Acesso excecional de suporte ---------------- */
  app.get("/api/support/grants", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "support.grant", "read");
    return db.select().from(supportAccessGrants).where(eq(supportAccessGrants.tenantId, ctx.tenant.id)).orderBy(desc(supportAccessGrants.createdAt));
  });

  app.post("/api/support/grants", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "support.grant", "billing");
    const body = parse(
      z.object({
        platformAdminEmail: z.string().email(),
        reason: z.string().trim().min(10).max(500),
        scope: z.array(z.enum(["customers", "products", "sales_orders", "finance_transactions", "employees", "settings"])).min(1),
        hours: z.number().int().min(1).max(72),
      }),
      req.body,
    );
    const now = new Date();
    const [g] = await db
      .insert(supportAccessGrants)
      .values({ tenantId: ctx.tenant.id, platformAdminEmail: body.platformAdminEmail.toLowerCase(), reason: body.reason, scope: body.scope, startsAt: now, endsAt: new Date(now.getTime() + body.hours * 3600_000), approvedBy: ctx.membership.id })
      .returning();
    await audit({ ...auditBase(ctx), action: "support.grant_created", entityType: "support_grant", entityId: g.id, summary: `Acesso de suporte autorizado a ${g.platformAdminEmail} por ${body.hours}h.`, metadata: { scope: body.scope, reason: body.reason } });
    return g;
  });

  app.post("/api/support/grants/:id/revoke", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "support.grant", "billing");
    const { id } = parse(uuidParam, req.params);
    const r = await db.update(supportAccessGrants).set({ revokedAt: new Date() }).where(and(eq(supportAccessGrants.id, id), eq(supportAccessGrants.tenantId, ctx.tenant.id))).returning({ id: supportAccessGrants.id });
    if (!r.length) throw notFound();
    await audit({ ...auditBase(ctx), action: "support.grant_revoked", entityType: "support_grant", entityId: id, summary: "Acesso de suporte revogado." });
    return { ok: true };
  });

  void lt;
}

export { datasetRows, DATASET_TABLES };
