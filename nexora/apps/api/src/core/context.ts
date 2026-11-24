/**
 * Contexto autenticado do pedido. O tenant vem SEMPRE da sessão (servidor),
 * nunca de parâmetros do cliente. Todas as rotas de negócio passam por
 * `requireCtx` + `authorize`.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, gt, inArray, isNull, lte, min, type AnyColumn } from "drizzle-orm";
import { db, dbScope, openTenantScope, rlsEnabled } from "../db/client.js";
import {
  branches,
  invoices,
  memberships,
  membershipRoles,
  permissionOverrides,
  plans,
  roles,
  sessions,
  subscriptions,
  tenantModules,
  tenants,
  users,
} from "../db/schema.js";
import { sha256 } from "./crypto.js";
import { AppError, forbidden, unauthorized } from "./errors.js";
import { ADMIN_ONLY, PERMISSIONS, permissionDef } from "./permissions.js";
import { capabilitiesFor, computeAccessState, type AccessCapabilities, type AccessState } from "./subscription.js";

export const SESSION_COOKIE = "nx_session";

export type Ctx = {
  sessionId: string;
  user: typeof users.$inferSelect;
  membership: typeof memberships.$inferSelect;
  tenant: typeof tenants.$inferSelect;
  subscription: typeof subscriptions.$inferSelect;
  plan: typeof plans.$inferSelect;
  accessState: AccessState;
  caps: AccessCapabilities;
  modules: Set<string>;
  permissions: Set<string>;
  /** null = todas as unidades; caso contrário, ids das unidades a que o utilizador está restrito. */
  branchScope: string[] | null;
  mfaPending: boolean; // tem 2FA ativo mas ainda não validou nesta sessão
  mfaEnrollmentRequired: boolean; // política da empresa exige 2FA e o utilizador não o configurou
  ip: string;
  traceId: string;
};

declare module "fastify" {
  interface FastifyRequest {
    nx?: Ctx | null;
    nxScope?: { release?: () => Promise<void> };
  }
}

function inWindow(from: Date | null, until: Date | null, now: Date) {
  return (!from || from <= now) && (!until || until >= now);
}

export async function effectivePermissions(
  membership: typeof memberships.$inferSelect,
  activeModules: Set<string>,
  now = new Date(),
): Promise<Set<string>> {
  let perms = new Set<string>();
  if (membership.level === "primary_admin") {
    perms = new Set(PERMISSIONS.map((p) => p.key));
  } else {
    const assigned = await db
      .select({ permissions: roles.permissions, validFrom: membershipRoles.validFrom, validUntil: membershipRoles.validUntil })
      .from(membershipRoles)
      .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
      .where(and(eq(membershipRoles.membershipId, membership.id), eq(membershipRoles.tenantId, membership.tenantId)));
    for (const a of assigned) if (inWindow(a.validFrom, a.validUntil, now)) a.permissions.forEach((x) => perms.add(x));
    const overrides = await db
      .select()
      .from(permissionOverrides)
      .where(and(eq(permissionOverrides.membershipId, membership.id), eq(permissionOverrides.tenantId, membership.tenantId)));
    for (const o of overrides) if (o.effect === "grant" && inWindow(o.validFrom, o.validUntil, now)) perms.add(o.permission);
    for (const o of overrides) if (o.effect === "deny" && inWindow(o.validFrom, o.validUntil, now)) perms.delete(o.permission);
    // Permissões administrativas só são efetivas para administradores secundários (âmbito delegado).
    if (membership.level !== "secondary_admin") for (const k of ADMIN_ONLY) perms.delete(k);
  }
  // Módulo não contratado ⇒ as suas permissões não têm efeito.
  for (const k of [...perms]) {
    const def = permissionDef(k);
    if (!def) perms.delete(k);
    else if (def.module && !activeModules.has(def.module)) perms.delete(k);
  }
  return perms;
}

export async function oldestUnpaidDueAt(tenantId: string): Promise<Date | null> {
  const [r] = await db
    .select({ due: min(invoices.dueAt) })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.status, ["issued", "partially_paid"]), eq(invoices.kind, "subscription")));
  return r?.due ?? null;
}

export async function activeModulesOf(tenantId: string): Promise<Set<string>> {
  const rows = await db
    .select({ code: tenantModules.moduleCode })
    .from(tenantModules)
    .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.status, "active")));
  return new Set(rows.map((r) => r.code));
}

export async function loadAccess(tenantId: string, now = new Date()) {
  const [row] = await db
    .select({ sub: subscriptions, plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.tenantId, tenantId));
  if (!row) throw new AppError(500, "NO_SUBSCRIPTION", "Empresa sem subscrição.");
  const state = computeAccessState(row.sub, await oldestUnpaidDueAt(tenantId), now);
  return { subscription: row.sub, plan: row.plan, accessState: state, caps: capabilitiesFor(state) };
}

/** Resolve a sessão a partir do cookie. Não lança: devolve null se não houver sessão válida. */
export async function resolveSession(req: FastifyRequest): Promise<Ctx | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const now = new Date();
  const [row] = await db
    .select({ s: sessions, u: users, m: memberships, t: tenants })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(memberships, eq(memberships.id, sessions.membershipId))
    .innerJoin(tenants, eq(tenants.id, sessions.tenantId))
    .where(and(eq(sessions.tokenHash, sha256(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  // Integridade: a membership tem de pertencer ao tenant da sessão e estar ativa.
  if (row.m.tenantId !== row.t.id || row.m.userId !== row.u.id || row.m.status !== "active") return null;
  const idleMs = (row.t.settings.idleTimeoutMinutes ?? 30) * 60_000;
  if (now.getTime() - row.s.lastSeenAt.getTime() > idleMs) {
    await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, row.s.id));
    return null;
  }
  await db.update(sessions).set({ lastSeenAt: now }).where(and(eq(sessions.id, row.s.id), lte(sessions.lastSeenAt, new Date(now.getTime() - 30_000))));

  const access = await loadAccess(row.t.id, now);
  const modules = await activeModulesOf(row.t.id);
  const permissions = await effectivePermissions(row.m, modules, now);
  const policy = row.t.settings.require2fa ?? "off";
  const needs2fa = policy === "all" || (policy === "admins" && row.m.level !== "member");
  return {
    sessionId: row.s.id,
    user: row.u,
    membership: row.m,
    tenant: row.t,
    ...access,
    modules,
    permissions,
    mfaPending: row.u.totpEnabled && !row.s.mfaVerified,
    mfaEnrollmentRequired: needs2fa && !row.u.totpEnabled,
    // Administradores não são restringidos por unidade.
    branchScope: row.m.level === "member" && row.m.branchIds.length ? row.m.branchIds : null,
    ip: req.ip,
    traceId: String(req.id),
  };
}

type Opts = { allowMfaPending?: boolean; allowEnrollment?: boolean };

/** Exige sessão completa (2FA validado e, se exigido pela política, configurado). */
export function requireCtx(req: FastifyRequest, opts: Opts = {}): Ctx {
  const ctx = req.nx;
  if (!ctx) throw unauthorized();
  if (ctx.mfaPending && !opts.allowMfaPending) throw new AppError(401, "MFA_REQUIRED", "Introduza o código de autenticação de dois fatores.");
  if (!ctx.mfaPending && ctx.mfaEnrollmentRequired && !opts.allowEnrollment && !opts.allowMfaPending)
    throw new AppError(403, "MFA_ENROLLMENT_REQUIRED", "A sua empresa exige 2FA. Configure-o para continuar.");
  return ctx;
}

export type AuthorizeKind = "read" | "write" | "export" | "billing";

/**
 * Verificação central de autorização no servidor:
 * permissão RBAC efetiva (já filtrada por módulo contratado) + estado da subscrição.
 */
export function authorize(ctx: Ctx, perm: string, kind?: AuthorizeKind) {
  const def = permissionDef(perm);
  if (!def) throw forbidden();
  if (def.module && !ctx.modules.has(def.module))
    throw new AppError(403, "MODULE_NOT_CONTRACTED", "Este módulo não está contratado pela sua empresa.", { module: def.module });
  if (!ctx.permissions.has(perm)) throw forbidden();
  const k: AuthorizeKind = kind ?? (def.write ? "write" : "read");
  if (!ctx.caps[k]) {
    if (ctx.accessState === "read_only")
      throw new AppError(403, "SUBSCRIPTION_READ_ONLY", "Subscrição em modo somente leitura por pagamento em atraso.");
    throw new AppError(403, "SUBSCRIPTION_SUSPENDED", "O acesso operacional está suspenso. Regularize a subscrição.", { state: ctx.accessState });
  }
}

export const can = (ctx: Ctx, perm: string) => ctx.permissions.has(perm);

/** Hook global: anexa o contexto (se existir) e aplica proteção CSRF em pedidos de escrita. */
export async function contextHook(req: FastifyRequest, reply: FastifyReply) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !req.url.startsWith("/api/webhooks/")) {
    // Defesa CSRF: cookies SameSite=Lax + cabeçalho personalizado que um formulário cross-site não consegue enviar.
    if (req.headers["x-nexora-csrf"] !== "1") {
      reply.code(403).send({ error: { code: "CSRF", message: "Pedido rejeitado (CSRF)." } });
      return reply;
    }
  }
  req.nx = await resolveSession(req);
}

/**
 * Hook (callback) que corre o resto do pedido dentro do âmbito de base de dados da empresa (RLS).
 * Tem de ser de callback para que `done` corra dentro de `AsyncLocalStorage.run`.
 * As rotas que atravessam empresas por natureza (portal Nexora, webhooks, troca de empresa) ficam de fora.
 */
// Identidade (sessões, palavra-passe, lista de empresas do utilizador), portal Nexora e webhooks.
const CROSS_TENANT = [/^\/api\/auth\//, /^\/api\/admin\//, /^\/api\/webhooks\//];
export function tenantScopeHook(req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) {
  const tenantId = req.nx?.tenant.id;
  const cfg = (req.routeOptions?.config ?? {}) as { crossTenant?: boolean };
  if (!tenantId || !rlsEnabled() || cfg.crossTenant || CROSS_TENANT.some((r) => r.test(req.url))) return done();
  openTenantScope(tenantId).then(
    (scope) => {
      req.nxScope = scope;
      reply.raw.once("close", () => void scope.release?.());
      dbScope.run(scope, () => done());
    },
    (e) => done(e),
  );
}

export async function releaseTenantScope(req: FastifyRequest) {
  await req.nxScope?.release?.();
}

export function auditBase(ctx: Ctx) {
  return { tenantId: ctx.tenant.id, actorType: "user" as const, actorId: ctx.membership.id, ip: ctx.ip, traceId: ctx.traceId };
}


/**
 * Condição SQL do âmbito por unidade para uma coluna branch_id.
 * Utilizadores restritos só veem registos das suas unidades (registos sem unidade ficam fora do âmbito).
 * `requested` permite filtrar por uma unidade concreta (validada contra o âmbito).
 */
export function branchCondition(ctx: Ctx, column: AnyColumn, requested?: string) {
  if (requested) {
    if (ctx.branchScope && !ctx.branchScope.includes(requested)) throw forbidden("Unidade fora do seu âmbito.", "BRANCH_OUT_OF_SCOPE");
    return eq(column, requested);
  }
  return ctx.branchScope ? inArray(column, ctx.branchScope) : undefined;
}

/** Valida a unidade indicada numa criação/alteração: tem de existir no tenant e estar no âmbito do utilizador. */
export async function resolveBranchForWrite(ctx: Ctx, branchId: string | null | undefined): Promise<string | null> {
  if (!branchId) {
    if (ctx.branchScope) {
      if (ctx.branchScope.length === 1) return ctx.branchScope[0];
      throw new AppError(400, "BRANCH_REQUIRED", "Indique a unidade.");
    }
    return null;
  }
  if (ctx.branchScope && !ctx.branchScope.includes(branchId)) throw forbidden("Unidade fora do seu âmbito.", "BRANCH_OUT_OF_SCOPE");
  const [b] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, branchId), eq(branches.tenantId, ctx.tenant.id)));
  if (!b) throw new AppError(400, "BAD_REQUEST", "Unidade inválida.");
  return branchId;
}
