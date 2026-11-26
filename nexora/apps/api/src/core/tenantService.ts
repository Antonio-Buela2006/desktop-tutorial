import { and, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client.js";
import {
  aiPolicies,
  aiWallets,
  employees,
  invoices,
  memberships,
  moduleCatalog,
  plans,
  roles,
  subscriptions,
  tenantModules,
  tenants,
  users,
  type TenantSettings,
} from "../db/schema.js";
import { audit } from "./audit.js";
import { hashPassword } from "./crypto.js";
import { AppError, badRequest, conflict } from "./errors.js";
import { SYSTEM_ROLES } from "./permissions.js";
import { addMonths, DAY, effectiveLimits, missingDependencies, MODULE_SWAP_FREE_DAYS, TRIAL_DAYS } from "./subscription.js";

export const DEFAULT_SETTINGS: TenantSettings = {
  require2fa: "admins",
  idleTimeoutMinutes: 30,
  maxSessionsPerUser: 5,
  languages: ["pt", "en"],
  dateLocale: "pt-AO",
  trashRetentionDays: 30,
  legalHold: false,
};

export type CreateTenantInput = {
  company: { name: string; legalName?: string; taxId?: string; country?: string; currency?: string; locale?: string };
  admin: { name: string; email: string; password: string; locale?: string };
  planCode: string;
  modules: string[];
  mode: "trial" | "paid";
  billingCycle?: "monthly" | "yearly";
  extraUsers?: number;
  extraEmployees?: number;
};

export async function getPlanByCode(code: string, tx: DbOrTx = db) {
  const [plan] = await tx.select().from(plans).where(and(eq(plans.code, code), eq(plans.isActive, true)));
  if (!plan) throw badRequest("Plano inválido.");
  return plan;
}

export async function catalogDeps(tx: DbOrTx = db) {
  const rows = await tx.select().from(moduleCatalog);
  return { rows, deps: new Map(rows.map((r) => [r.code, r.dependsOn])) };
}

/** Valida seleção de módulos: existentes, contratáveis e com dependências satisfeitas. */
export async function validateModuleSelection(codes: string[], tx: DbOrTx = db) {
  const { rows, deps } = await catalogDeps(tx);
  const set = new Set(codes);
  for (const c of set) {
    const m = rows.find((r) => r.code === c);
    if (!m || m.status !== "active") throw badRequest(`O módulo "${c}" não está disponível para contratação.`);
    const missing = missingDependencies(c, set, deps);
    if (missing.length) throw badRequest(`O módulo "${m.name}" requer: ${missing.join(", ")}.`, { missing });
  }
  return rows.filter((r) => set.has(r.code));
}

let invoiceSeq = 0;
export function nextInvoiceNumber() {
  invoiceSeq = (invoiceSeq + 1) % 1000;
  const d = new Date();
  return `NX-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}-${Date.now().toString(36).toUpperCase()}${invoiceSeq}`;
}

/** Calcula o valor de uma subscrição: plano + módulos além da franquia + capacidade extra. */
export function priceSubscription(
  plan: typeof plans.$inferSelect,
  selected: (typeof moduleCatalog.$inferSelect)[],
  cycle: "monthly" | "yearly",
  extraUsers: number,
  extraEmployees: number,
) {
  if (plan.priceMonthly === null || (cycle === "yearly" && plan.priceYearly === null))
    throw new AppError(422, "PRICE_PENDING", "O preço deste plano ainda não foi definido pela Nexora. Utilize o período de demonstração.");
  const months = cycle === "yearly" ? 12 : 1;
  const lines: { description: string; quantity: number; unitPrice: number; total: number }[] = [];
  const base = cycle === "yearly" ? plan.priceYearly! : plan.priceMonthly;
  lines.push({ description: `Plano ${plan.name} (${cycle === "yearly" ? "anual" : "mensal"})`, quantity: 1, unitPrice: base, total: base });
  const included = plan.includedModules ?? selected.length;
  const extras = selected.slice(included);
  for (const m of extras) {
    const unit = (m.priceMonthly ?? plan.extraModulePrice ?? 0) * months;
    lines.push({ description: `Módulo adicional: ${m.name}`, quantity: 1, unitPrice: unit, total: unit });
  }
  if (extraUsers > 0) {
    const unit = (plan.extraUserPrice ?? 0) * months;
    lines.push({ description: "Utilizadores adicionais", quantity: extraUsers, unitPrice: unit, total: unit * extraUsers });
  }
  if (extraEmployees > 0) {
    lines.push({ description: "Funcionários adicionais (capacidade)", quantity: extraEmployees, unitPrice: 0, total: 0 });
  }
  const subtotal = Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;
  return { lines, subtotal };
}

export async function createSystemRoles(tenantId: string, tx: DbOrTx) {
  return tx
    .insert(roles)
    .values(SYSTEM_ROLES.map((r) => ({ tenantId, code: r.code, name: r.name, description: r.description, isSystem: true, permissions: r.permissions })))
    .returning();
}

/**
 * Registo de empresa (jornada §2.1). Trial: ativa já com acesso amplo e dados fictícios.
 * Pago: fica "pending_payment" com fatura emitida; é ativada automaticamente quando o
 * pagamento é confirmado (webhook) — ver billing/payments.
 */
export async function createTenant(input: CreateTenantInput) {
  const email = input.admin.email.trim().toLowerCase();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw conflict("Já existe uma conta com este e-mail. Inicie sessão para continuar.", "EMAIL_EXISTS");
    const plan = await getPlanByCode(input.planCode, tx);
    const now = new Date();
    let selected: (typeof moduleCatalog.$inferSelect)[];
    if (input.mode === "trial") {
      // Trial: acesso amplo a todos os módulos ativos do catálogo.
      selected = (await tx.select().from(moduleCatalog)).filter((m) => m.status === "active");
    } else {
      selected = await validateModuleSelection(input.modules, tx);
      if (!selected.length) throw badRequest("Selecione pelo menos um módulo.");
    }
    const cycle = input.billingCycle ?? "monthly";
    const extraUsers = Math.max(0, input.extraUsers ?? 0);
    const extraEmployees = Math.max(0, input.extraEmployees ?? 0);
    const pricing = input.mode === "paid" ? priceSubscription(plan, selected, cycle, extraUsers, extraEmployees) : null;

    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: input.company.name.trim(),
        legalName: input.company.legalName,
        taxId: input.company.taxId,
        country: input.company.country ?? "AO",
        currency: input.company.currency ?? plan.currency,
        defaultLocale: input.company.locale ?? "pt",
        isDemo: input.mode === "trial",
        settings: DEFAULT_SETTINGS,
      })
      .returning();
    const [user] = await tx
      .insert(users)
      .values({ email, name: input.admin.name.trim(), passwordHash: await hashPassword(input.admin.password), locale: input.admin.locale ?? "pt" })
      .returning();
    const [membership] = await tx.insert(memberships).values({ tenantId: tenant.id, userId: user.id, level: "primary_admin" }).returning();
    await createSystemRoles(tenant.id, tx);
    await tx.insert(subscriptions).values({
      tenantId: tenant.id,
      planId: plan.id,
      status: input.mode === "trial" ? "trial" : "pending_payment",
      billingCycle: cycle,
      trialEndsAt: input.mode === "trial" ? new Date(now.getTime() + TRIAL_DAYS * DAY) : null,
      extraUsers,
      extraEmployees,
    });
    await tx.insert(tenantModules).values(
      selected.map((m) => ({ tenantId: tenant.id, moduleCode: m.code, status: "active", source: input.mode === "trial" ? "trial" : "included" })),
    );
    await tx.insert(aiPolicies).values({ tenantId: tenant.id, allowedModules: selected.map((m) => m.code) });
    const allowance = plan.aiCreditsMonthly ?? 0;
    await tx.insert(aiWallets).values({ tenantId: tenant.id, balance: input.mode === "trial" ? Math.max(allowance, 100) : 0, monthlyAllowance: allowance });

    let invoiceId: string | null = null;
    if (pricing) {
      const [inv] = await tx
        .insert(invoices)
        .values({
          tenantId: tenant.id,
          number: nextInvoiceNumber(),
          status: "issued",
          kind: "subscription",
          currency: plan.currency,
          lines: pricing.lines,
          subtotal: pricing.subtotal,
          total: pricing.subtotal,
          dueAt: new Date(now.getTime() + 3 * DAY),
          meta: { initial: true, cycle },
        })
        .returning();
      invoiceId = inv.id;
    }
    await audit(
      {
        tenantId: tenant.id,
        actorType: "user",
        actorId: membership.id,
        action: "tenant.registered",
        entityType: "tenant",
        entityId: tenant.id,
        summary: `Empresa registada (${input.mode === "trial" ? "demonstração 14 dias" : "subscrição paga pendente"}) no plano ${plan.name}.`,
        metadata: { plan: plan.code, modules: selected.map((m) => m.code) },
      },
      tx,
    );
    return { tenant, user, membership, invoiceId };
  });
}

/** Ativa a subscrição após pagamento confirmado (idempotente). */
export async function activateSubscription(tenantId: string, tx: DbOrTx) {
  const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId));
  const [plan] = await tx.select().from(plans).where(eq(plans.id, sub.planId));
  const now = new Date();
  const months = sub.billingCycle === "yearly" ? 12 : 1;
  if (sub.status === "pending_payment" || sub.status === "trial" || sub.status === "expired" || sub.status === "canceled") {
    const first = !sub.activatedAt;
    await tx
      .update(subscriptions)
      .set({
        status: "active",
        activatedAt: sub.activatedAt ?? now,
        moduleSwapWindowEndsAt: sub.moduleSwapWindowEndsAt ?? new Date(now.getTime() + MODULE_SWAP_FREE_DAYS * DAY),
        currentPeriodStart: now,
        currentPeriodEnd: addMonths(now, months),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEndsAt: null,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id));
    if (first) {
      await tx.update(aiWallets).set({ balance: plan.aiCreditsMonthly ?? 0, monthlyAllowance: plan.aiCreditsMonthly ?? 0, periodStart: now }).where(eq(aiWallets.tenantId, tenantId));
    }
    await audit({ tenantId, actorType: "system", action: "subscription.activated", entityType: "subscription", entityId: sub.id, summary: "Subscrição ativada após confirmação de pagamento." }, tx);
  } else if (sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd < new Date(now.getTime() + 5 * DAY)) {
    // Renovação: avança o período
    await tx
      .update(subscriptions)
      .set({ currentPeriodStart: sub.currentPeriodEnd, currentPeriodEnd: addMonths(sub.currentPeriodEnd, months), updatedAt: now })
      .where(eq(subscriptions.id, sub.id));
  }
}

/** Contagens usadas pelos limites do plano (funcionários e utilizadores são independentes). */
export async function usageOf(tenantId: string, tx: DbOrTx = db) {
  const [e] = await tx
    .select({ n: count() })
    .from(employees)
    .where(and(eq(employees.tenantId, tenantId), eq(employees.status, "active"), isNull(employees.deletedAt)));
  const [u] = await tx.select({ n: count() }).from(memberships).where(and(eq(memberships.tenantId, tenantId), eq(memberships.status, "active")));
  const [a] = await tx
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.status, "active"), eq(memberships.level, "secondary_admin")));
  const [m] = await tx.select({ n: count() }).from(tenantModules).where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.status, "active")));
  return { employees: e.n, users: u.n, secondaryAdmins: a.n, modules: m.n };
}

export async function limitsOf(tenantId: string, tx: DbOrTx = db) {
  const [row] = await tx.select({ s: subscriptions, p: plans }).from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId)).where(eq(subscriptions.tenantId, tenantId));
  return effectiveLimits(row.p, row.s.extraUsers, row.s.extraEmployees);
}

/** Bloqueia criação acima do limite com mensagem clara e opções (§3.3). */
export async function assertCapacity(tenantId: string, kind: "users" | "employees" | "secondaryAdmins", tx: DbOrTx = db) {
  const limits = await limitsOf(tenantId, tx);
  const usage = await usageOf(tenantId, tx);
  const max = kind === "users" ? limits.maxUsers : kind === "employees" ? limits.maxEmployees : limits.maxSecondaryAdmins;
  const used = usage[kind];
  if (max !== null && used >= max) {
    const label = kind === "users" ? "utilizadores com conta" : kind === "employees" ? "funcionários registados" : "administradores secundários";
    throw new AppError(409, "LIMIT_REACHED", `Atingiu o limite de ${label} do seu plano (${max}). Compre capacidade adicional ou faça upgrade. As contas e registos existentes continuam a funcionar.`, { kind, max, used });
  }
}

export async function otherActiveTenantsOfUser(userId: string, exceptTenant: string) {
  return db.select().from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.status, "active"), ne(memberships.tenantId, exceptTenant)));
}

export async function membershipsWithIds(tenantId: string, ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(memberships).where(and(eq(memberships.tenantId, tenantId), inArray(memberships.id, ids)));
}
