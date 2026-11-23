/**
 * Portal administrativo da Nexora (equipa interna) — autenticação e sessões
 * separadas das empresas, RBAC administrativo e auditoria. Os técnicos NÃO
 * têm acesso livre a dados empresariais: só metadados, e conteúdo apenas via
 * concessão temporária autorizada pela empresa.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, count, desc, eq, gt, isNull, sql as dsql, sum } from "drizzle-orm";
import { z } from "zod";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { db } from "../db/client.js";
import {
  aiCreditTransactions,
  auditEvents,
  invoices,
  memberships,
  moduleCatalog,
  payments,
  plans,
  platformAdmins,
  platformSessions,
  platformSettings,
  subscriptions,
  supportAccessGrants,
  tenants,
} from "../db/schema.js";
import { audit } from "../core/audit.js";
import { decrypt, encrypt, randomToken, sha256, verifyPassword } from "../core/crypto.js";
import { AppError, badRequest, forbidden, notFound, unauthorized } from "../core/errors.js";
import { parse, setSessionCookie, uuidParam } from "../core/http.js";
import { computeAccessState, DAY } from "../core/subscription.js";
import { oldestUnpaidDueAt } from "../core/context.js";
import { usageOf } from "../core/tenantService.js";
import { confirmPayment } from "./billing.routes.js";
import { runAllJobs } from "../jobs/jobs.js";
import { DATASET_TABLES } from "./governance.routes.js";

const ADMIN_COOKIE = "nx_admin";
type Admin = typeof platformAdmins.$inferSelect;
const ROLE_CAN: Record<string, string[]> = {
  owner: ["tenants", "commercial", "payments", "settings", "jobs", "audit", "support"],
  billing: ["tenants", "commercial", "payments", "audit"],
  support: ["tenants", "support", "audit"],
  readonly: ["tenants", "audit"],
};

async function requireAdmin(req: FastifyRequest, area?: string): Promise<{ admin: Admin; sessionId: string }> {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (!token) throw unauthorized();
  const [row] = await db.select({ s: platformSessions, a: platformAdmins }).from(platformSessions).innerJoin(platformAdmins, eq(platformAdmins.id, platformSessions.adminId))
    .where(and(eq(platformSessions.tokenHash, sha256(token)), isNull(platformSessions.revokedAt), gt(platformSessions.expiresAt, new Date())));
  if (!row || !row.a.isActive) throw unauthorized();
  // Sessões administrativas: expiração por inatividade mais curta (15 min).
  if (Date.now() - row.s.lastSeenAt.getTime() > 15 * 60_000) {
    await db.update(platformSessions).set({ revokedAt: new Date() }).where(eq(platformSessions.id, row.s.id));
    throw unauthorized("Sessão administrativa expirada por inatividade.");
  }
  await db.update(platformSessions).set({ lastSeenAt: new Date() }).where(eq(platformSessions.id, row.s.id));
  if (area && !ROLE_CAN[row.a.role]?.includes(area)) throw forbidden();
  return { admin: row.a, sessionId: row.s.id };
}

const adminAudit = (a: Admin, req: FastifyRequest) => ({ actorType: "platform_admin" as const, actorId: a.id, ip: req.ip, traceId: String(req.id) });

export async function adminRoutes(app: FastifyInstance) {
  app.post("/api/admin/auth/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) => {
    const body = parse(z.object({ email: z.string().email(), password: z.string(), code: z.string().optional() }), req.body);
    const [a] = await db.select().from(platformAdmins).where(eq(platformAdmins.email, body.email.toLowerCase()));
    if (!a || !a.isActive || !(await verifyPassword(body.password, a.passwordHash))) throw new AppError(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");
    if (a.totpEnabled) {
      if (!body.code) throw new AppError(401, "MFA_REQUIRED", "Introduza o código 2FA.");
      const r = await verifyTotp({ secret: decrypt(a.totpSecret!), token: body.code, epochTolerance: 30 });
      if (!r.valid) throw new AppError(401, "INVALID_CODE", "Código inválido.");
    }
    const token = randomToken();
    await db.insert(platformSessions).values({ adminId: a.id, tokenHash: sha256(token), mfaVerified: a.totpEnabled, expiresAt: new Date(Date.now() + 8 * 3600_000) });
    setSessionCookie(reply, ADMIN_COOKIE, token, 8 * 3600);
    await audit({ tenantId: null, ...adminAudit(a, req), action: "admin.login", summary: `Login no portal Nexora: ${a.email}.` });
    return { ok: true, mfaEnabled: a.totpEnabled };
  });

  app.post("/api/admin/auth/logout", async (req, reply) => {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (token) await db.update(platformSessions).set({ revokedAt: new Date() }).where(eq(platformSessions.tokenHash, sha256(token)));
    reply.clearCookie(ADMIN_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/admin/me", async (req) => {
    const { admin } = await requireAdmin(req);
    return { id: admin.id, email: admin.email, name: admin.name, role: admin.role, totpEnabled: admin.totpEnabled, areas: ROLE_CAN[admin.role] };
  });

  app.post("/api/admin/2fa/setup", async (req) => {
    const { admin } = await requireAdmin(req);
    const secret = generateSecret();
    await db.update(platformAdmins).set({ totpSecret: encrypt(secret), totpEnabled: false }).where(eq(platformAdmins.id, admin.id));
    const uri = generateURI({ issuer: "Nexora Admin", label: admin.email, secret });
    return { secret, qr: await QRCode.toDataURL(uri) };
  });

  app.post("/api/admin/2fa/enable", async (req) => {
    const { admin } = await requireAdmin(req);
    const { code } = parse(z.object({ code: z.string().regex(/^\d{6}$/) }), req.body);
    const [a] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, admin.id));
    if (!a.totpSecret || !(await verifyTotp({ secret: decrypt(a.totpSecret), token: code, epochTolerance: 30 })).valid) throw new AppError(401, "INVALID_CODE", "Código inválido.");
    await db.update(platformAdmins).set({ totpEnabled: true }).where(eq(platformAdmins.id, a.id));
    await audit({ tenantId: null, ...adminAudit(a, req), action: "admin.mfa_enabled", summary: "2FA ativado na conta administrativa." });
    return { ok: true };
  });

  /* ---- Empresas (apenas metadados) ---- */
  app.get("/api/admin/tenants", async (req) => {
    await requireAdmin(req, "tenants");
    const rows = await db.select({ t: tenants, s: subscriptions, p: plans }).from(tenants).innerJoin(subscriptions, eq(subscriptions.tenantId, tenants.id)).innerJoin(plans, eq(plans.id, subscriptions.planId)).orderBy(desc(tenants.createdAt));
    const now = new Date();
    return Promise.all(
      rows.map(async (r) => ({
        id: r.t.id, name: r.t.name, country: r.t.country, isDemo: r.t.isDemo, createdAt: r.t.createdAt,
        plan: r.p.name, status: r.s.status, accessState: computeAccessState(r.s, await oldestUnpaidDueAt(r.t.id), now),
        currentPeriodEnd: r.s.currentPeriodEnd, trialEndsAt: r.s.trialEndsAt, usage: await usageOf(r.t.id),
      })),
    );
  });

  app.post("/api/admin/tenants/:id/extend-trial", async (req) => {
    const { admin } = await requireAdmin(req, "commercial");
    const { id } = parse(uuidParam, req.params);
    const { days, reason } = parse(z.object({ days: z.number().int().min(1).max(30), reason: z.string().min(5).max(300) }), req.body);
    const [s] = await db.select().from(subscriptions).where(and(eq(subscriptions.tenantId, id), eq(subscriptions.status, "trial")));
    if (!s) throw notFound();
    const base = s.trialEndsAt && s.trialEndsAt > new Date() ? s.trialEndsAt : new Date();
    await db.update(subscriptions).set({ trialEndsAt: new Date(base.getTime() + days * DAY) }).where(eq(subscriptions.id, s.id));
    await audit({ tenantId: id, ...adminAudit(admin, req), action: "admin.trial_extended", entityType: "subscription", entityId: s.id, summary: `Demonstração prolongada ${days} dias pela equipa Nexora: ${reason}` });
    return { ok: true };
  });

  app.get("/api/admin/metrics", async (req) => {
    await requireAdmin(req, "tenants");
    const subs = await db.select({ s: subscriptions, p: plans }).from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId));
    const byStatus: Record<string, number> = {};
    let mrr = 0;
    for (const { s, p } of subs) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      if (s.status === "active") mrr += s.billingCycle === "yearly" ? (p.priceYearly ?? 0) / 12 : p.priceMonthly ?? 0;
    }
    const [paid] = await db.select({ total: sum(invoices.amountPaid) }).from(invoices);
    const [ai] = await db.select({ used: sum(aiCreditTransactions.amount) }).from(aiCreditTransactions).where(dsql`${aiCreditTransactions.amount} < 0`);
    const [users] = await db.select({ n: count() }).from(memberships).where(eq(memberships.status, "active"));
    const [pending] = await db.select({ n: count() }).from(payments).where(eq(payments.status, "pending"));
    return { tenants: subs.length, byStatus, mrrEstimate: Math.round(mrr), collected: Number(paid.total ?? 0), aiCreditsConsumed: -Number(ai.used ?? 0), activeUsers: users.n, pendingPayments: pending.n, note: "Valores calculados com a configuração comercial atual (valores de teste até validação)." };
  });

  /* ---- Configuração comercial (sem alterar código) ---- */
  app.get("/api/admin/plans", async (req) => {
    await requireAdmin(req, "commercial");
    return db.select().from(plans).orderBy(plans.sortOrder);
  });

  app.put("/api/admin/plans/:id", async (req) => {
    const { admin } = await requireAdmin(req, "commercial");
    const { id } = parse(uuidParam, req.params);
    const n = z.number().min(0).nullable();
    const ni = z.number().int().min(0).nullable();
    const body = parse(
      z.object({
        name: z.string().min(2).max(60), description: z.string().max(400), priceMonthly: n, priceYearly: n, maxEmployees: ni, maxUsers: ni, maxSecondaryAdmins: ni,
        includedModules: ni, aiCreditsMonthly: ni, extraUserPrice: n, extraModulePrice: n, commercialConfirmed: z.boolean(), isActive: z.boolean(), currency: z.string().length(3),
      }),
      req.body,
    );
    const [before] = await db.select().from(plans).where(eq(plans.id, id));
    if (!before) throw notFound();
    await db.update(plans).set({ ...body, updatedAt: new Date() }).where(eq(plans.id, id));
    // Histórico de alterações comerciais = trilho de auditoria com antes/depois.
    await audit({ tenantId: null, ...adminAudit(admin, req), action: "admin.plan_updated", entityType: "plan", entityId: id, summary: `Plano ${before.name} alterado.`, metadata: { before, after: body } });
    return { ok: true };
  });

  app.get("/api/admin/modules", async (req) => {
    await requireAdmin(req, "commercial");
    return db.select().from(moduleCatalog).orderBy(moduleCatalog.sortOrder);
  });

  app.put("/api/admin/modules/:code", async (req) => {
    const { admin } = await requireAdmin(req, "commercial");
    const { code } = parse(z.object({ code: z.string() }), req.params);
    const body = parse(
      z.object({
        name: z.string().min(2).max(80), description: z.string().max(400), status: z.enum(["active", "pending", "inactive"]), provisional: z.boolean(),
        priceMonthly: z.number().min(0).nullable(), dependsOn: z.array(z.string()).max(17), minPlan: z.string().nullable(),
      }),
      req.body,
    );
    const [before] = await db.select().from(moduleCatalog).where(eq(moduleCatalog.code, code));
    if (!before) throw notFound();
    if (body.status === "active" && !before.implemented) throw badRequest("Não é possível ativar comercialmente um módulo ainda não implementado.");
    if (body.dependsOn.includes(code)) throw badRequest("Um módulo não pode depender de si próprio.");
    await db.update(moduleCatalog).set({ ...body, updatedAt: new Date() }).where(eq(moduleCatalog.code, code));
    await audit({ tenantId: null, ...adminAudit(admin, req), action: "admin.module_updated", entityType: "module", entityId: code, summary: `Módulo ${code} alterado.`, metadata: { before, after: body } });
    return { ok: true };
  });

  app.get("/api/admin/settings", async (req) => {
    await requireAdmin(req, "settings");
    return db.select().from(platformSettings);
  });

  app.put("/api/admin/settings/:key", async (req) => {
    const { admin } = await requireAdmin(req, "settings");
    const { key } = parse(z.object({ key: z.enum(["ai_costs", "ai_credit_packs", "retention", "tax", "payment_providers"]) }), req.params);
    const { value } = parse(z.object({ value: z.any() }), req.body);
    const [before] = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
    await db.insert(platformSettings).values({ key, value }).onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date() } });
    await audit({ tenantId: null, ...adminAudit(admin, req), action: "admin.setting_updated", entityType: "setting", entityId: key, summary: `Parâmetro global ${key} alterado.`, metadata: { before: before?.value ?? null, after: value } });
    return { ok: true };
  });

  /* ---- Pagamentos e reconciliação manual (transferências) ---- */
  app.get("/api/admin/payments", async (req) => {
    await requireAdmin(req, "payments");
    return db.select({ p: payments, t: tenants.name, inv: invoices.number }).from(payments).innerJoin(tenants, eq(tenants.id, payments.tenantId)).innerJoin(invoices, eq(invoices.id, payments.invoiceId)).orderBy(desc(payments.createdAt)).limit(200)
      .then((r) => r.map((x) => ({ ...x.p, checkoutToken: undefined, tenant: x.t, invoice: x.inv })));
  });

  app.post("/api/admin/payments/:id/confirm", async (req) => {
    const { admin } = await requireAdmin(req, "payments");
    const { id } = parse(uuidParam, req.params);
    const { amount, note } = parse(z.object({ amount: z.number().positive(), note: z.string().min(3).max(300) }), req.body);
    const [p] = await db.select().from(payments).where(eq(payments.id, id));
    if (!p) throw notFound();
    const result = await confirmPayment(id, amount, admin.id);
    await audit({ tenantId: p.tenantId, ...adminAudit(admin, req), action: "admin.payment_reconciled", entityType: "payment", entityId: id, summary: `Pagamento reconciliado manualmente (${amount}): ${note}` });
    return { ok: true, result };
  });

  app.post("/api/admin/jobs/run", async (req) => {
    const { admin } = await requireAdmin(req, "jobs");
    const r = await runAllJobs();
    await audit({ tenantId: null, ...adminAudit(admin, req), action: "admin.jobs_run", summary: "Jobs periódicos executados manualmente.", metadata: { ...r } });
    return r;
  });

  app.get("/api/admin/audit", async (req) => {
    await requireAdmin(req, "audit");
    return db.select().from(auditEvents).where(eq(auditEvents.actorType, "platform_admin")).orderBy(desc(auditEvents.id)).limit(200);
  });

  /* ---- Suporte: acesso a conteúdo só com concessão ativa, âmbito e prazo ---- */
  app.get("/api/admin/support/grants", async (req) => {
    const { admin } = await requireAdmin(req, "support");
    return db.select({ g: supportAccessGrants, tenant: tenants.name }).from(supportAccessGrants).innerJoin(tenants, eq(tenants.id, supportAccessGrants.tenantId))
      .where(eq(supportAccessGrants.platformAdminEmail, admin.email)).orderBy(desc(supportAccessGrants.createdAt)).then((r) => r.map((x) => ({ ...x.g, tenant: x.tenant, active: !x.g.revokedAt && x.g.startsAt <= new Date() && x.g.endsAt > new Date() })));
  });

  app.get("/api/admin/support/grants/:id/data/:dataset", async (req) => {
    const { admin } = await requireAdmin(req, "support");
    const { id, dataset } = parse(z.object({ id: z.string().uuid(), dataset: z.string() }), req.params);
    const now = new Date();
    const [g] = await db.select().from(supportAccessGrants).where(and(eq(supportAccessGrants.id, id), eq(supportAccessGrants.platformAdminEmail, admin.email)));
    if (!g || g.revokedAt || g.startsAt > now || g.endsAt <= now) throw forbidden("Sem concessão de acesso ativa.");
    if (!g.scope.includes(dataset) || !DATASET_TABLES[dataset]) throw forbidden("Fora do âmbito autorizado.");
    const t = DATASET_TABLES[dataset];
    let rows: any[] = await db.select().from(t).where(eq(t.tenantId, g.tenantId)).limit(200);
    // Minimização: sem dados salariais mesmo com acesso a funcionários.
    if (dataset === "employees") rows = rows.map(({ salary: _s, ...r }) => r);
    await audit({ tenantId: g.tenantId, ...adminAudit(admin, req), action: "support.data_accessed", entityType: "support_grant", entityId: g.id, summary: `Suporte Nexora (${admin.email}) consultou "${dataset}" ao abrigo da concessão: ${g.reason}`, metadata: { rows: rows.length } });
    return rows;
  });
}
