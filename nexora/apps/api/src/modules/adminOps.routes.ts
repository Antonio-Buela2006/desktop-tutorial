/** Portal Nexora: retenção de dados aprovada e registo de incidentes. */
import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull, or, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { incidents, subscriptions, tenants } from "../db/schema.js";
import { audit } from "../core/audit.js";
import { requireCtx } from "../core/context.js";
import { AppError, badRequest, notFound } from "../core/errors.js";
import { parse, uuidParam } from "../core/http.js";
import { notifyByPermission } from "../core/notify.js";
import { m, render, asLocale } from "../core/messages.js";
import { DAY } from "../core/subscription.js";
import { purgeCanceledTenant } from "../core/retention.js";
import { adminAudit, requireAdmin } from "./admin.routes.js";
import { getSetting } from "./billing.routes.js";

const STATUS_PT: Record<string, string> = { investigating: "Em investigação", identified: "Causa identificada", monitoring: "Em monitorização", resolved: "Resolvido" };

async function notifyIncident(inc: typeof incidents.$inferSelect, note: string) {
  const targets = inc.allTenants ? (await db.select({ id: tenants.id }).from(tenants)).map((t) => t.id) : inc.affectedTenants;
  for (const t of targets)
    await notifyByPermission(t, "settings.manage", {
      type: "incident.update",
      severity: inc.severity === "critical" || inc.severity === "high" ? "critical" : "warning",
      title: m("incident.update.title", { title: inc.title, status: STATUS_PT[inc.status] ? m(`incident.status.${inc.status}`) : inc.status }),
      body: note,
      dedupeKey: `incident:${inc.id}:${inc.updates.length}`,
    });
}

export async function adminOpsRoutes(app: FastifyInstance) {
  /* ---------------- Retenção ---------------- */
  app.get("/api/admin/retention", async (req) => {
    await requireAdmin(req, "tenants");
    const r = await getSetting("retention", { postCancelDays: 90, trialSuspendedDays: 30 });
    const now = Date.now();
    const rows = await db.select({ t: tenants, s: subscriptions }).from(tenants).innerJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
      .where(or(inArray(subscriptions.status, ["canceled", "expired"]), eq(subscriptions.cancelAtPeriodEnd, true)));
    return rows.map(({ t, s }) => {
      const endedAt = s.status === "canceled" || s.status === "expired" ? s.updatedAt : s.currentPeriodEnd;
      const dueAt = endedAt ? new Date(endedAt.getTime() + r.postCancelDays * DAY) : null;
      return {
        tenantId: t.id, name: t.name, status: s.status, endedAt, dueAt,
        due: !!dueAt && dueAt.getTime() <= now && (s.status === "canceled" || s.status === "expired"),
        legalHold: !!t.settings.legalHold, purgedAt: t.settings.dataPurgedAt ?? null,
      };
    });
  });

  app.post("/api/admin/retention/:id/purge", async (req) => {
    const { admin } = await requireAdmin(req, "jobs"); // apenas owner
    const { id } = parse(uuidParam, req.params);
    const { confirmName, reason } = parse(z.object({ confirmName: z.string(), reason: z.string().trim().min(10).max(500) }), req.body);
    const [row] = await db.select({ t: tenants, s: subscriptions }).from(tenants).innerJoin(subscriptions, eq(subscriptions.tenantId, tenants.id)).where(eq(tenants.id, id));
    if (!row) throw notFound();
    if (confirmName.trim() !== row.t.name) throw badRequest("O nome indicado não corresponde à empresa.");
    if (row.t.settings.legalHold) throw new AppError(409, "LEGAL_HOLD", "A empresa está sob retenção legal: eliminação proibida.");
    if (!["canceled", "expired"].includes(row.s.status)) throw badRequest("Só empresas com subscrição terminada podem ser eliminadas.");
    const r = await getSetting("retention", { postCancelDays: 90 });
    if (row.s.updatedAt.getTime() + r.postCancelDays * DAY > Date.now()) throw new AppError(409, "RETENTION_NOT_ELAPSED", "O prazo de retenção ainda não terminou.");
    await purgeCanceledTenant(id, admin.id);
    await audit({ tenantId: null, ...adminAudit(admin, req), action: "admin.retention_executed", entityType: "tenant", entityId: id, summary: `Retenção executada para "${row.t.name}": ${reason}` });
    return { ok: true };
  });

  /* ---------------- Incidentes ---------------- */
  app.get("/api/admin/incidents", async (req) => {
    await requireAdmin(req, "tenants");
    return db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(100);
  });

  app.post("/api/admin/incidents", async (req) => {
    const { admin } = await requireAdmin(req, "support");
    const b = parse(
      z.object({ title: z.string().trim().min(5).max(160), severity: z.enum(["low", "medium", "high", "critical"]), description: z.string().max(4000).default(""), affectedTenants: z.array(z.string().uuid()).max(500).default([]), allTenants: z.boolean().default(false), notify: z.boolean().default(true) }),
      req.body,
    );
    if (!b.allTenants && !b.affectedTenants.length && b.notify) throw badRequest("Indique as empresas afetadas ou marque todas.");
    const [inc] = await db.insert(incidents).values({ ...b, createdBy: admin.id, updates: [{ at: new Date().toISOString(), by: admin.email, status: "investigating", note: b.description || "Incidente aberto." }] }).returning();
    await audit({ tenantId: null, ...adminAudit(admin, req), action: "incident.opened", entityType: "incident", entityId: inc.id, summary: `Incidente aberto (${b.severity}): ${b.title}` });
    if (b.notify) await notifyIncident(inc, b.description || "Estamos a investigar.");
    return inc;
  });

  app.post("/api/admin/incidents/:id/updates", async (req) => {
    const { admin } = await requireAdmin(req, "support");
    const { id } = parse(uuidParam, req.params);
    const b = parse(z.object({ status: z.enum(["investigating", "identified", "monitoring", "resolved"]), note: z.string().trim().min(3).max(2000), notify: z.boolean().default(true) }), req.body);
    const [cur] = await db.select().from(incidents).where(eq(incidents.id, id));
    if (!cur) throw notFound();
    if (cur.status === "resolved") throw badRequest("O incidente já está resolvido.");
    const updates = [...cur.updates, { at: new Date().toISOString(), by: admin.email, status: b.status, note: b.note }];
    const [inc] = await db.update(incidents).set({ status: b.status, updates, resolvedAt: b.status === "resolved" ? new Date() : null }).where(eq(incidents.id, id)).returning();
    await audit({ tenantId: null, ...adminAudit(admin, req), action: "incident.updated", entityType: "incident", entityId: id, summary: `Incidente "${inc.title}": ${STATUS_PT[b.status]} — ${b.note}` });
    if (b.notify) await notifyIncident(inc, b.note);
    return inc;
  });

  /** Incidentes ativos visíveis para a empresa da sessão (banner no painel). */
  app.get("/api/incidents/active", async (req) => {
    const ctx = requireCtx(req, { allowEnrollment: true });
    const rows = await db.select().from(incidents)
      .where(and(isNull(incidents.resolvedAt), or(eq(incidents.allTenants, true), dsql`${ctx.tenant.id}::uuid = any(${incidents.affectedTenants})`)))
      .orderBy(desc(incidents.createdAt));
    return rows.map((i) => ({ id: i.id, title: i.title, severity: i.severity, status: i.status, statusLabel: STATUS_PT[i.status], lastUpdate: i.updates[i.updates.length - 1] }));
  });
}
