/** Unidades/filiais, preferências de notificação, configuração de alertas, anonimização e primeiros passos. */
import type { FastifyInstance } from "fastify";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  aiPolicies,
  branches,
  customers,
  employees,
  fileAssets,
  invitations,
  membershipRoles,
  memberships,
  notificationPreferences,
  tenants,
  type AlertSettings,
} from "../db/schema.js";
import { audit } from "../core/audit.js";
import { auditBase, authorize, can, requireCtx } from "../core/context.js";
import { AppError, badRequest, notFound } from "../core/errors.js";
import { parse, uuidParam } from "../core/http.js";
import { UNMUTABLE_PREFIXES } from "../core/notify.js";

export const DEFAULT_ALERTS: AlertSettings = {
  lowStock: true,
  abnormalExpense: true,
  abnormalExpenseMultiplier: 3,
  salesDrop: true,
  salesDropPct: 30,
  emailCritical: true,
};

/** Tipos de notificação que o utilizador pode silenciar (os restantes são obrigatórios). */
export const MUTABLE_TYPES = [
  { type: "ai.alert.low_stock", label: "Alertas de stock baixo" },
  { type: "ai.alert.expense", label: "Alertas de despesas anormais" },
  { type: "ai.alert.sales_drop", label: "Alertas de queda de vendas" },
  { type: "ai.approval", label: "Ações da IA a aguardar aprovação" },
  { type: "finance.approval", label: "Despesas a aguardar aprovação" },
];

export async function companyExtrasRoutes(app: FastifyInstance) {
  /* ---------------- Unidades / filiais ---------------- */
  app.get("/api/company/branches", async (req) => {
    const ctx = requireCtx(req);
    const rows = await db.select().from(branches).where(eq(branches.tenantId, ctx.tenant.id)).orderBy(asc(branches.name));
    const counts = await db.select({ branchId: employees.branchId, n: count() }).from(employees)
      .where(and(eq(employees.tenantId, ctx.tenant.id), isNull(employees.deletedAt), eq(employees.status, "active"))).groupBy(employees.branchId);
    return rows.map((b) => ({ ...b, employees: counts.find((c) => c.branchId === b.id)?.n ?? 0 }));
  });

  const branchBody = z.object({ code: z.string().trim().min(1).max(20), name: z.string().trim().min(2).max(120), address: z.string().trim().max(300).optional(), isActive: z.boolean().default(true) });

  app.post("/api/company/branches", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "settings.manage");
    const body = parse(branchBody, req.body);
    try {
      const [b] = await db.insert(branches).values({ ...body, tenantId: ctx.tenant.id }).returning();
      await audit({ ...auditBase(ctx), action: "branch.created", entityType: "branch", entityId: b.id, summary: `Unidade "${b.name}" criada.` });
      return b;
    } catch (e: any) {
      if (e?.code === "23505" || e?.cause?.code === "23505") throw new AppError(409, "DUPLICATE_CODE", "Já existe uma unidade com este código.");
      throw e;
    }
  });

  app.put("/api/company/branches/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "settings.manage");
    const { id } = parse(uuidParam, req.params);
    const body = parse(branchBody.partial(), req.body);
    const [b] = await db.update(branches).set(body).where(and(eq(branches.id, id), eq(branches.tenantId, ctx.tenant.id))).returning();
    if (!b) throw notFound();
    await audit({ ...auditBase(ctx), action: "branch.updated", entityType: "branch", entityId: id, summary: `Unidade "${b.name}" atualizada.`, metadata: body });
    return b;
  });

  /* ---------------- Preferências de notificação (próprias) ---------------- */
  app.get("/api/notifications/preferences", async (req) => {
    const ctx = requireCtx(req);
    const [p] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.membershipId, ctx.membership.id));
    return { preferences: p ?? { emailEnabled: true, mutedTypes: [], quietStartHour: null, quietEndHour: null }, mutableTypes: MUTABLE_TYPES, alwaysOn: UNMUTABLE_PREFIXES };
  });

  app.put("/api/notifications/preferences", async (req) => {
    const ctx = requireCtx(req);
    const body = parse(
      z.object({
        emailEnabled: z.boolean(),
        mutedTypes: z.array(z.enum(MUTABLE_TYPES.map((t) => t.type) as [string, ...string[]])).max(20),
        quietStartHour: z.number().int().min(0).max(23).nullable(),
        quietEndHour: z.number().int().min(0).max(23).nullable(),
      }),
      req.body,
    );
    if ((body.quietStartHour === null) !== (body.quietEndHour === null)) throw badRequest("Indique o início e o fim do horário de silêncio.");
    await db
      .insert(notificationPreferences)
      .values({ ...body, membershipId: ctx.membership.id, tenantId: ctx.tenant.id })
      .onConflictDoUpdate({ target: notificationPreferences.membershipId, set: { ...body, updatedAt: new Date() } });
    return { ok: true };
  });

  /* ---------------- Configuração dos alertas inteligentes (administradores) ---------------- */
  app.get("/api/company/alerts", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "settings.manage", "read");
    return { ...DEFAULT_ALERTS, ...(ctx.tenant.settings.alerts ?? {}) };
  });

  app.put("/api/company/alerts", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "settings.manage");
    const body = parse(
      z.object({
        lowStock: z.boolean(),
        abnormalExpense: z.boolean(),
        abnormalExpenseMultiplier: z.number().min(1.5).max(20),
        salesDrop: z.boolean(),
        salesDropPct: z.number().int().min(5).max(90),
        emailCritical: z.boolean(),
      }),
      req.body,
    );
    await db.update(tenants).set({ settings: { ...ctx.tenant.settings, alerts: body } }).where(eq(tenants.id, ctx.tenant.id));
    await audit({ ...auditBase(ctx), action: "alerts.updated", entityType: "tenant", entityId: ctx.tenant.id, summary: "Configuração de alertas atualizada.", metadata: { before: ctx.tenant.settings.alerts ?? DEFAULT_ALERTS, after: body } });
    return { ok: true };
  });

  /* ---------------- Retenção legal (legal hold) ---------------- */
  app.put("/api/company/legal-hold", async (req) => {
    const ctx = requireCtx(req);
    if (ctx.membership.level !== "primary_admin") throw new AppError(403, "FORBIDDEN", "Apenas o administrador principal pode alterar a retenção legal.");
    const { enabled, reason } = parse(z.object({ enabled: z.boolean(), reason: z.string().trim().min(5).max(300) }), req.body);
    await db.update(tenants).set({ settings: { ...ctx.tenant.settings, legalHold: enabled } }).where(eq(tenants.id, ctx.tenant.id));
    await audit({ ...auditBase(ctx), action: enabled ? "legal_hold.enabled" : "legal_hold.disabled", entityType: "tenant", entityId: ctx.tenant.id, summary: `Retenção legal ${enabled ? "ativada" : "desativada"}: ${reason}` });
    return { ok: true };
  });

  /* ---------------- Anonimização de ex-funcionários ---------------- */
  app.post("/api/company/employees/:id/anonymize", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "employees.edit");
    authorize(ctx, "employees.delete");
    const { id } = parse(uuidParam, req.params);
    parse(z.object({ confirm: z.literal(true) }), req.body);
    if (ctx.tenant.settings.legalHold) throw new AppError(409, "LEGAL_HOLD", "A empresa está sob retenção legal: não é possível anonimizar dados.");
    const [e] = await db.select().from(employees).where(and(eq(employees.id, id), eq(employees.tenantId, ctx.tenant.id)));
    if (!e) throw notFound();
    if (e.status !== "exited") throw badRequest("Só é possível anonimizar funcionários com saída registada.");
    if (e.anonymizedAt) return { ok: true };
    const [acct] = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.tenantId, ctx.tenant.id), eq(memberships.employeeId, id), eq(memberships.status, "active")));
    if (acct) throw badRequest("Desative primeiro a conta de acesso associada.");
    const ref = id.slice(0, 8).toUpperCase();
    await db.transaction(async (tx) => {
      // Remove dados de identificação; mantém datas e função para histórico e obrigações legais.
      // O salário mantém-se como registo laboral/contabilístico (prazo legal a validar).
      await tx.update(employees).set({ fullName: `Ex-funcionário #${ref}`, email: null, anonymizedAt: new Date() }).where(eq(employees.id, id));
      await tx.update(fileAssets).set({ deletedAt: new Date() }).where(and(eq(fileAssets.tenantId, ctx.tenant.id), eq(fileAssets.entityType, "employee"), eq(fileAssets.entityId, id), isNull(fileAssets.deletedAt)));
      await tx.update(invitations).set({ revokedAt: new Date() }).where(and(eq(invitations.tenantId, ctx.tenant.id), eq(invitations.employeeId, id), isNull(invitations.acceptedAt)));
      await audit({ ...auditBase(ctx), action: "employee.anonymized", entityType: "employee", entityId: id, summary: `Dados pessoais do ex-funcionário #${ref} anonimizados; documentos movidos para eliminação.` }, tx);
    });
    return { ok: true };
  });

  /* ---------------- Primeiros passos (onboarding) ---------------- */
  app.get("/api/company/onboarding", async (req) => {
    const ctx = requireCtx(req);
    const isAdmin = ctx.membership.level !== "member";
    const [{ emp }] = await db.select({ emp: count() }).from(employees).where(and(eq(employees.tenantId, ctx.tenant.id), isNull(employees.deletedAt)));
    const [{ mem }] = await db.select({ mem: count() }).from(memberships).where(eq(memberships.tenantId, ctx.tenant.id));
    const [{ inv }] = await db.select({ inv: count() }).from(invitations).where(eq(invitations.tenantId, ctx.tenant.id));
    const [{ roles }] = await db.select({ roles: count() }).from(membershipRoles).where(eq(membershipRoles.tenantId, ctx.tenant.id));
    const [{ cust }] = await db.select({ cust: count() }).from(customers).where(and(eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt)));
    const [pol] = await db.select({ updatedAt: aiPolicies.updatedAt }).from(aiPolicies).where(eq(aiPolicies.tenantId, ctx.tenant.id));
    const steps = [
      { key: "mfa", label: "Ativar a autenticação de dois fatores", done: ctx.user.totpEnabled, link: "/app/security" },
      ...(isAdmin
        ? [
            { key: "company", label: "Completar os dados da empresa (denominação legal e NIF)", done: !!(ctx.tenant.legalName && ctx.tenant.taxId), link: "/app/settings" },
            { key: "employees", label: "Registar os funcionários", done: emp > 0, link: "/app/employees" },
            { key: "invite", label: "Convidar a equipa e atribuir funções", done: mem > 1 || inv > 0 || roles > 0, link: "/app/users" },
            { key: "ai", label: "Rever a política de IA da empresa", done: !!pol && pol.updatedAt.getTime() - ctx.tenant.createdAt.getTime() > 5000, link: "/app/ai?tab=policy" },
          ]
        : []),
      ...(can(ctx, "crm.create") ? [{ key: "customers", label: "Registar os primeiros clientes", done: cust > 0, link: "/app/customers" }] : []),
    ];
    return { steps, completed: steps.filter((s) => s.done).length, total: steps.length };
  });
}
