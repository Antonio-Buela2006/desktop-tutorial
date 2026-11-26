/** Painel da empresa: utilizadores, funções/permissões, funcionários, definições e titularidade. */
import type { FastifyInstance } from "fastify";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql as dsql, type AnyColumn } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  adminTransfers,
  employees,
  invitations,
  memberships,
  membershipRoles,
  permissionOverrides,
  roles,
  sessions,
  tenants,
  users,
} from "../db/schema.js";
import { audit } from "../core/audit.js";
import { auditBase, authorize, branchCondition, can, requireCtx, resolveBranchForWrite, type Ctx } from "../core/context.js";
import { randomToken, sha256, verifyPassword } from "../core/crypto.js";
import { AppError, badRequest, forbidden, notFound } from "../core/errors.js";
import { pageQuery, parse, uuidParam, orderFor } from "../core/http.js";
import { ADMIN_ONLY, PERMISSIONS, PERMISSION_KEYS, permissionLabel } from "../core/permissions.js";
import { assertCapacity, limitsOf, usageOf } from "../core/tenantService.js";
import { notifyMembership, sendMail } from "../core/notify.js";
import { m, render, asLocale } from "../core/messages.js";
import { config } from "../config.js";

const isAdmin = (ctx: Ctx) => ctx.membership.level === "primary_admin" || ctx.membership.level === "secondary_admin";

/** Um administrador secundário não pode conceder permissões que ele próprio não tem (âmbito delegado). */
function assertCanGrant(ctx: Ctx, perms: string[]) {
  if (ctx.membership.level === "primary_admin") return;
  const beyond = perms.filter((p) => !ctx.permissions.has(p));
  if (beyond.length) throw forbidden(`Não pode conceder permissões fora do seu âmbito: ${beyond.join(", ")}.`);
}

async function loadMember(ctx: Ctx, id: string) {
  const [m] = await db.select().from(memberships).where(and(eq(memberships.id, id), eq(memberships.tenantId, ctx.tenant.id)));
  if (!m) throw notFound();
  return m;
}

const employeeBody = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().email().max(160).optional().or(z.literal("").transform(() => undefined)),
  jobTitle: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  branchId: z.string().uuid().nullable().optional(),
  salary: z.number().min(0).max(1e12).optional(),
});

export async function companyRoutes(app: FastifyInstance) {
  app.get("/api/meta/permissions", async (req) => {
    const ctx = requireCtx(req);
    return PERMISSIONS.map((p) => ({ ...p, label: permissionLabel(p.key, ctx.user.locale), adminOnly: ADMIN_ONLY.has(p.key) }));
  });

  /* ---------------- Utilizadores (contas com acesso) ---------------- */

  app.get("/api/company/users", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "users.view");
    const rows = await db
      .select({ m: memberships, u: { id: users.id, name: users.name, email: users.email, totpEnabled: users.totpEnabled } })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.tenantId, ctx.tenant.id))
      .orderBy(asc(users.name));
    const assigned = await db
      .select({ membershipId: membershipRoles.membershipId, roleId: membershipRoles.roleId, name: roles.name, validUntil: membershipRoles.validUntil, validFrom: membershipRoles.validFrom })
      .from(membershipRoles)
      .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
      .where(eq(membershipRoles.tenantId, ctx.tenant.id));
    const invites = await db
      .select({ id: invitations.id, email: invitations.email, name: invitations.name, level: invitations.level, expiresAt: invitations.expiresAt })
      .from(invitations)
      .where(and(eq(invitations.tenantId, ctx.tenant.id), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)));
    return {
      users: rows.map((r) => ({ ...r.m, user: r.u, roles: assigned.filter((a) => a.membershipId === r.m.id) })),
      invitations: invites,
      limits: await limitsOf(ctx.tenant.id),
      usage: await usageOf(ctx.tenant.id),
    };
  });

  app.post("/api/company/users/invite", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "users.invite");
    const body = parse(
      z.object({
        email: z.string().email().max(160),
        name: z.string().trim().min(2).max(120),
        roleIds: z.array(z.string().uuid()).max(20).default([]),
        level: z.enum(["member", "secondary_admin"]).default("member"),
        employeeId: z.string().uuid().optional(),
      }),
      req.body,
    );
    if (body.level === "secondary_admin" && ctx.membership.level !== "primary_admin")
      throw forbidden("Apenas o administrador principal pode nomear administradores secundários.");
    await assertCapacity(ctx.tenant.id, "users");
    if (body.level === "secondary_admin") await assertCapacity(ctx.tenant.id, "secondaryAdmins");
    const roleRows = body.roleIds.length ? await db.select().from(roles).where(and(eq(roles.tenantId, ctx.tenant.id), inArray(roles.id, body.roleIds))) : [];
    if (roleRows.length !== body.roleIds.length) throw badRequest("Função inválida.");
    assertCanGrant(ctx, roleRows.flatMap((r) => r.permissions));
    if (body.employeeId) {
      const [e] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, body.employeeId), eq(employees.tenantId, ctx.tenant.id)));
      if (!e) throw badRequest("Funcionário inválido.");
    }
    const token = randomToken();
    const [inv] = await db
      .insert(invitations)
      .values({ tenantId: ctx.tenant.id, email: body.email.toLowerCase(), name: body.name, roleIds: body.roleIds, level: body.level, employeeId: body.employeeId, tokenHash: sha256(token), invitedBy: ctx.membership.id, expiresAt: new Date(Date.now() + 7 * 86400_000) })
      .returning();
    const link = `${config.webOrigin}/invite?token=${token}`;
    {
      const lc = asLocale(ctx.tenant.defaultLocale);
      await sendMail(body.email, render(m("mail.invite.subject", { company: ctx.tenant.name }), lc), render(m("mail.invite.body", { name: ctx.user.name, link }), lc));
    }
    await audit({ ...auditBase(ctx), action: "user.invited", entityType: "invitation", entityId: inv.id, summary: `Convite enviado para ${body.email}.`, metadata: { level: body.level, roles: roleRows.map((r) => r.code) } });
    // O link só é devolvido fora de produção (em produção segue apenas por e-mail).
    return { id: inv.id, ...(config.isProd ? {} : { devLink: link }) };
  });

  app.delete("/api/company/invitations/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "users.invite");
    const { id } = parse(uuidParam, req.params);
    const r = await db.update(invitations).set({ revokedAt: new Date() }).where(and(eq(invitations.id, id), eq(invitations.tenantId, ctx.tenant.id))).returning({ id: invitations.id });
    if (!r.length) throw notFound();
    await audit({ ...auditBase(ctx), action: "user.invitation_revoked", entityType: "invitation", entityId: id, summary: "Convite revogado." });
    return { ok: true };
  });

  /** Atribuição de funções (com validade opcional para substituições temporárias) e ajustes por utilizador. */
  app.put("/api/company/users/:id/access", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "users.edit");
    const { id } = parse(uuidParam, req.params);
    const body = parse(
      z.object({
        roles: z.array(z.object({ roleId: z.string().uuid(), validFrom: z.coerce.date().nullable().optional(), validUntil: z.coerce.date().nullable().optional() })).max(20),
        overrides: z
          .array(z.object({ permission: z.string(), effect: z.enum(["grant", "deny"]), validFrom: z.coerce.date().nullable().optional(), validUntil: z.coerce.date().nullable().optional(), reason: z.string().max(200).optional() }))
          .max(60)
          .default([]),
      }),
      req.body,
    );
    const m = await loadMember(ctx, id);
    if (m.level === "primary_admin") throw forbidden("As permissões do administrador principal não são editáveis.");
    if (m.id === ctx.membership.id) throw forbidden("Não pode alterar as suas próprias permissões.");
    if (m.level === "secondary_admin" && ctx.membership.level !== "primary_admin") throw forbidden("Apenas o administrador principal gere administradores secundários.");
    const roleRows = body.roles.length ? await db.select().from(roles).where(and(eq(roles.tenantId, ctx.tenant.id), inArray(roles.id, body.roles.map((r) => r.roleId)))) : [];
    if (roleRows.length !== new Set(body.roles.map((r) => r.roleId)).size) throw badRequest("Função inválida.");
    for (const o of body.overrides) if (!PERMISSION_KEYS.has(o.permission)) throw badRequest(`Permissão desconhecida: ${o.permission}`);
    assertCanGrant(ctx, [...roleRows.flatMap((r) => r.permissions), ...body.overrides.filter((o) => o.effect === "grant").map((o) => o.permission)]);
    await db.transaction(async (tx) => {
      await tx.delete(membershipRoles).where(and(eq(membershipRoles.membershipId, m.id), eq(membershipRoles.tenantId, ctx.tenant.id)));
      for (const r of body.roles)
        await tx.insert(membershipRoles).values({ tenantId: ctx.tenant.id, membershipId: m.id, roleId: r.roleId, validFrom: r.validFrom ?? null, validUntil: r.validUntil ?? null }).onConflictDoNothing();
      await tx.delete(permissionOverrides).where(and(eq(permissionOverrides.membershipId, m.id), eq(permissionOverrides.tenantId, ctx.tenant.id)));
      if (body.overrides.length)
        await tx.insert(permissionOverrides).values(body.overrides.map((o) => ({ ...o, validFrom: o.validFrom ?? null, validUntil: o.validUntil ?? null, tenantId: ctx.tenant.id, membershipId: m.id })));
      await audit({ ...auditBase(ctx), action: "user.access_changed", entityType: "membership", entityId: m.id, summary: "Funções/permissões do utilizador alteradas.", metadata: { roles: roleRows.map((r) => r.code), overrides: body.overrides } }, tx);
    });
    return { ok: true };
  });

  app.get("/api/company/users/:id/access", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "users.view");
    const { id } = parse(uuidParam, req.params);
    const m = await loadMember(ctx, id);
    const r = await db.select().from(membershipRoles).where(and(eq(membershipRoles.membershipId, m.id), eq(membershipRoles.tenantId, ctx.tenant.id)));
    const o = await db.select().from(permissionOverrides).where(and(eq(permissionOverrides.membershipId, m.id), eq(permissionOverrides.tenantId, ctx.tenant.id)));
    return { roles: r, overrides: o, level: m.level };
  });

  /** Âmbito por unidade de um utilizador (vazio = todas). Administradores nunca são restringidos. */
  app.put("/api/company/users/:id/branches", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "users.edit");
    const { id } = parse(uuidParam, req.params);
    const { branchIds } = parse(z.object({ branchIds: z.array(z.string().uuid()).max(50) }), req.body);
    const m = await loadMember(ctx, id);
    if (m.level !== "member") throw badRequest("Administradores não são restringidos por unidade.");
    const { branches } = await import("../db/schema.js");
    const valid = branchIds.length ? await db.select({ id: branches.id }).from(branches).where(and(eq(branches.tenantId, ctx.tenant.id), inArray(branches.id, branchIds))) : [];
    if (valid.length !== new Set(branchIds).size) throw badRequest("Unidade inválida.");
    // Um gestor restringido não pode alargar o âmbito de outro utilizador para além do seu.
    if (ctx.branchScope && (branchIds.length === 0 || branchIds.some((b) => !ctx.branchScope!.includes(b)))) throw forbidden("Não pode atribuir unidades fora do seu âmbito.");
    await db.update(memberships).set({ branchIds: [...new Set(branchIds)] }).where(eq(memberships.id, m.id));
    await audit({ ...auditBase(ctx), action: "user.branches_changed", entityType: "membership", entityId: m.id, summary: branchIds.length ? `Acesso restringido a ${branchIds.length} unidade(s).` : "Acesso a todas as unidades.", metadata: { before: m.branchIds, after: branchIds } });
    return { ok: true };
  });

  /** Saída/desativação: revoga acesso imediatamente, preserva histórico e liberta a vaga. */
  app.post("/api/company/users/:id/disable", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "users.disable");
    const { id } = parse(uuidParam, req.params);
    const m = await loadMember(ctx, id);
    if (m.level === "primary_admin") throw forbidden("Transfira a titularidade antes de desativar o administrador principal.");
    if (m.level === "secondary_admin" && ctx.membership.level !== "primary_admin") throw forbidden();
    if (m.id === ctx.membership.id) throw badRequest("Não pode desativar a sua própria conta.");
    await disableMembership(ctx, m.id, "Conta desativada.");
    return { ok: true };
  });

  app.post("/api/company/users/:id/enable", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "users.edit");
    const { id } = parse(uuidParam, req.params);
    const m = await loadMember(ctx, id);
    if (m.status === "active") return { ok: true };
    await assertCapacity(ctx.tenant.id, "users");
    await db.update(memberships).set({ status: "active", disabledAt: null }).where(eq(memberships.id, m.id));
    await audit({ ...auditBase(ctx), action: "user.enabled", entityType: "membership", entityId: m.id, summary: "Conta reativada." });
    return { ok: true };
  });

  /* ---------------- Funções (RBAC predefinido + personalizado) ---------------- */

  app.get("/api/company/roles", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "roles.view");
    const rows = await db.select().from(roles).where(eq(roles.tenantId, ctx.tenant.id)).orderBy(desc(roles.isSystem), asc(roles.name));
    const counts = await db.select({ roleId: membershipRoles.roleId, n: count() }).from(membershipRoles).where(eq(membershipRoles.tenantId, ctx.tenant.id)).groupBy(membershipRoles.roleId);
    return rows.map((r) => ({ ...r, members: counts.find((c) => c.roleId === r.id)?.n ?? 0 }));
  });

  const roleBody = z.object({ name: z.string().trim().min(2).max(80), description: z.string().max(300).default(""), permissions: z.array(z.string()).max(PERMISSIONS.length) });

  app.post("/api/company/roles", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "roles.manage");
    const body = parse(roleBody, req.body);
    for (const p of body.permissions) if (!PERMISSION_KEYS.has(p)) throw badRequest(`Permissão desconhecida: ${p}`);
    assertCanGrant(ctx, body.permissions);
    const code = "custom_" + randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, "");
    const [r] = await db.insert(roles).values({ tenantId: ctx.tenant.id, code, name: body.name, description: body.description, permissions: body.permissions, isSystem: false }).returning();
    await audit({ ...auditBase(ctx), action: "role.created", entityType: "role", entityId: r.id, summary: `Função "${r.name}" criada.`, metadata: { permissions: body.permissions } });
    return r;
  });

  app.put("/api/company/roles/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "roles.manage");
    const { id } = parse(uuidParam, req.params);
    const body = parse(roleBody, req.body);
    for (const p of body.permissions) if (!PERMISSION_KEYS.has(p)) throw badRequest(`Permissão desconhecida: ${p}`);
    assertCanGrant(ctx, body.permissions);
    const [before] = await db.select().from(roles).where(and(eq(roles.id, id), eq(roles.tenantId, ctx.tenant.id)));
    if (!before) throw notFound();
    const [r] = await db.update(roles).set({ name: body.name, description: body.description, permissions: body.permissions }).where(eq(roles.id, id)).returning();
    await audit({ ...auditBase(ctx), action: "role.updated", entityType: "role", entityId: id, summary: `Função "${r.name}" atualizada.`, metadata: { before: before.permissions, after: body.permissions } });
    return r;
  });

  app.delete("/api/company/roles/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "roles.manage");
    const { id } = parse(uuidParam, req.params);
    const [r] = await db.select().from(roles).where(and(eq(roles.id, id), eq(roles.tenantId, ctx.tenant.id)));
    if (!r) throw notFound();
    if (r.isSystem) throw badRequest("Funções predefinidas não podem ser eliminadas (pode editá-las).");
    const [{ n }] = await db.select({ n: count() }).from(membershipRoles).where(eq(membershipRoles.roleId, id));
    if (n > 0) throw badRequest("Remova a função dos utilizadores antes de a eliminar.");
    await db.delete(roles).where(eq(roles.id, id));
    await audit({ ...auditBase(ctx), action: "role.deleted", entityType: "role", entityId: id, summary: `Função "${r.name}" eliminada.` });
    return { ok: true };
  });

  /* ---------------- Funcionários (cadastro independente das contas) ---------------- */

  app.get("/api/company/employees", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "employees.view");
    const q = parse(pageQuery.extend({ status: z.enum(["active", "exited", "all"]).default("active"), branchId: z.string().uuid().optional() }), req.query);
    const where = and(
      eq(employees.tenantId, ctx.tenant.id),
      isNull(employees.deletedAt),
      branchCondition(ctx, employees.branchId, q.branchId),
      q.status === "all" ? undefined : eq(employees.status, q.status),
      q.q ? or(ilike(employees.fullName, `%${q.q}%`), ilike(employees.department, `%${q.q}%`), ilike(employees.jobTitle, `%${q.q}%`)) : undefined,
    );
    // O salário só é ordenável por quem o pode ver (a ordem revelaria quem ganha mais).
    const sortable: Record<string, AnyColumn> = { fullName: employees.fullName, jobTitle: employees.jobTitle, department: employees.department, ...(can(ctx, "employees.view_salary") ? { salary: employees.salary } : {}) };
    const rows = await db.select().from(employees).where(where).orderBy(...orderFor(q, sortable, [asc(employees.fullName)], employees.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const [{ n }] = await db.select({ n: count() }).from(employees).where(where);
    const showSalary = can(ctx, "employees.view_salary");
    const accounts = await db.select({ employeeId: memberships.employeeId, status: memberships.status, id: memberships.id }).from(memberships).where(eq(memberships.tenantId, ctx.tenant.id));
    return {
      items: rows.map((e) => ({ ...e, salary: showSalary ? e.salary : undefined, account: accounts.find((a) => a.employeeId === e.id) ?? null })),
      total: n,
      limits: await limitsOf(ctx.tenant.id),
      usage: await usageOf(ctx.tenant.id),
    };
  });

  app.post("/api/company/employees", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "employees.create");
    const body = parse(employeeBody, req.body);
    if (body.salary !== undefined && !can(ctx, "employees.view_salary")) throw forbidden("Sem permissão para registar dados salariais.");
    const branchId = await resolveBranchForWrite(ctx, body.branchId);
    await assertCapacity(ctx.tenant.id, "employees");
    const [e] = await db.insert(employees).values({ ...body, branchId, tenantId: ctx.tenant.id }).returning();
    await audit({ ...auditBase(ctx), action: "employee.created", entityType: "employee", entityId: e.id, summary: `Funcionário ${e.fullName} registado.` });
    return e;
  });

  app.put("/api/company/employees/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "employees.edit");
    const { id } = parse(uuidParam, req.params);
    const body = parse(employeeBody.partial(), req.body);
    if (body.salary !== undefined && !can(ctx, "employees.view_salary")) throw forbidden("Sem permissão para alterar dados salariais.");
    if (body.branchId !== undefined) body.branchId = await resolveBranchForWrite(ctx, body.branchId);
    const [e] = await db.update(employees).set(body).where(and(eq(employees.id, id), eq(employees.tenantId, ctx.tenant.id), isNull(employees.deletedAt), branchCondition(ctx, employees.branchId))).returning();
    if (!e) throw notFound();
    await audit({ ...auditBase(ctx), action: "employee.updated", entityType: "employee", entityId: id, summary: `Funcionário ${e.fullName} atualizado.`, metadata: { fields: Object.keys(body) } });
    return e;
  });

  /** Saída de funcionário: marca saída, desativa a conta associada (revoga sessões) e liberta vagas. */
  app.post("/api/company/employees/:id/offboard", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "employees.offboard");
    const { id } = parse(uuidParam, req.params);
    const { exitDate } = parse(z.object({ exitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }), req.body);
    const [e] = await db.update(employees).set({ status: "exited", exitDate }).where(and(eq(employees.id, id), eq(employees.tenantId, ctx.tenant.id), isNull(employees.deletedAt), branchCondition(ctx, employees.branchId))).returning();
    if (!e) throw notFound();
    const [acct] = await db.select().from(memberships).where(and(eq(memberships.tenantId, ctx.tenant.id), eq(memberships.employeeId, id), eq(memberships.status, "active")));
    if (acct) {
      if (acct.level === "primary_admin") throw badRequest("Transfira a titularidade antes de registar a saída do administrador principal.");
      await disableMembership(ctx, acct.id, `Saída do funcionário ${e.fullName}: acesso revogado.`);
    }
    await audit({ ...auditBase(ctx), action: "employee.offboarded", entityType: "employee", entityId: id, summary: `Saída registada para ${e.fullName} (${exitDate}).`, metadata: { accountDisabled: !!acct } });
    return { ok: true, accountDisabled: !!acct };
  });

  app.delete("/api/company/employees/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "employees.delete");
    const { id } = parse(uuidParam, req.params);
    const [e] = await db.update(employees).set({ deletedAt: new Date() }).where(and(eq(employees.id, id), eq(employees.tenantId, ctx.tenant.id), isNull(employees.deletedAt), branchCondition(ctx, employees.branchId))).returning();
    if (!e) throw notFound();
    await audit({ ...auditBase(ctx), action: "employee.deleted", entityType: "employee", entityId: id, summary: `Funcionário ${e.fullName} movido para a lixeira.` });
    return { ok: true };
  });

  /* ---------------- Definições da empresa ---------------- */

  app.get("/api/company/settings", async (req) => {
    const ctx = requireCtx(req);
    return { name: ctx.tenant.name, legalName: ctx.tenant.legalName, taxId: ctx.tenant.taxId, country: ctx.tenant.country, currency: ctx.tenant.currency, defaultLocale: ctx.tenant.defaultLocale, settings: ctx.tenant.settings };
  });

  app.put("/api/company/settings", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "settings.manage");
    const body = parse(
      z.object({
        name: z.string().trim().min(2).max(120),
        legalName: z.string().trim().max(160).nullable().optional(),
        taxId: z.string().trim().max(40).nullable().optional(),
        defaultLocale: z.enum(["pt", "en"]),
        settings: z.object({
          require2fa: z.enum(["off", "admins", "all"]),
          // Políticas mínimas globais de segurança
          idleTimeoutMinutes: z.number().int().min(5).max(480),
          maxSessionsPerUser: z.number().int().min(1).max(20),
          languages: z.array(z.enum(["pt", "en"])).min(1),
          dateLocale: z.string().max(10),
          trashRetentionDays: z.number().int().min(7).max(365),
        }),
      }),
      req.body,
    );
    const settings = { ...ctx.tenant.settings, ...body.settings };
    await db.update(tenants).set({ name: body.name, legalName: body.legalName, taxId: body.taxId, defaultLocale: body.defaultLocale, settings }).where(eq(tenants.id, ctx.tenant.id));
    await audit({ ...auditBase(ctx), action: "settings.updated", entityType: "tenant", entityId: ctx.tenant.id, summary: "Definições da empresa atualizadas.", metadata: { before: ctx.tenant.settings, after: settings } });
    return { ok: true };
  });

  /* ---------------- Transferência do administrador principal ---------------- */

  app.post("/api/company/ownership/transfer", async (req) => {
    const ctx = requireCtx(req);
    if (ctx.membership.level !== "primary_admin") throw forbidden("Apenas o administrador principal pode transferir a titularidade.");
    const body = parse(z.object({ toMembershipId: z.string().uuid(), password: z.string() }), req.body);
    if (!(await verifyPassword(body.password, ctx.user.passwordHash))) throw new AppError(401, "INVALID_CREDENTIALS", "Palavra-passe incorreta.");
    const target = await loadMember(ctx, body.toMembershipId);
    if (target.status !== "active" || target.id === ctx.membership.id) throw badRequest("Destinatário inválido.");
    await db.update(adminTransfers).set({ status: "canceled" }).where(and(eq(adminTransfers.tenantId, ctx.tenant.id), eq(adminTransfers.status, "pending")));
    const [t] = await db.insert(adminTransfers).values({ tenantId: ctx.tenant.id, fromMembershipId: ctx.membership.id, toMembershipId: target.id, expiresAt: new Date(Date.now() + 72 * 3600_000) }).returning();
    await notifyMembership(ctx.tenant.id, target.id, { type: "ownership.transfer", severity: "warning", title: m("ownership.transfer.title"), body: m("ownership.transfer.body", { name: ctx.user.name }), link: "/app/settings" });
    await audit({ ...auditBase(ctx), action: "ownership.transfer_requested", entityType: "admin_transfer", entityId: t.id, summary: "Pedido de transferência de titularidade iniciado." });
    return { id: t.id };
  });

  app.get("/api/company/ownership/pending", async (req) => {
    const ctx = requireCtx(req);
    const [t] = await db.select().from(adminTransfers).where(and(eq(adminTransfers.tenantId, ctx.tenant.id), eq(adminTransfers.status, "pending"), eq(adminTransfers.toMembershipId, ctx.membership.id)));
    return t && t.expiresAt > new Date() ? t : null;
  });

  app.post("/api/company/ownership/:id/accept", async (req) => {
    const ctx = requireCtx(req);
    const { id } = parse(uuidParam, req.params);
    const { password } = parse(z.object({ password: z.string() }), req.body);
    if (!(await verifyPassword(password, ctx.user.passwordHash))) throw new AppError(401, "INVALID_CREDENTIALS", "Palavra-passe incorreta.");
    const [t] = await db.select().from(adminTransfers).where(and(eq(adminTransfers.id, id), eq(adminTransfers.tenantId, ctx.tenant.id), eq(adminTransfers.status, "pending")));
    if (!t || t.toMembershipId !== ctx.membership.id || t.expiresAt < new Date()) throw notFound();
    await db.transaction(async (tx) => {
      await tx.update(memberships).set({ level: "secondary_admin" }).where(and(eq(memberships.id, t.fromMembershipId), eq(memberships.tenantId, ctx.tenant.id)));
      await tx.update(memberships).set({ level: "primary_admin" }).where(eq(memberships.id, ctx.membership.id));
      await tx.update(adminTransfers).set({ status: "accepted", decidedAt: new Date() }).where(eq(adminTransfers.id, id));
      await audit({ ...auditBase(ctx), action: "ownership.transferred", entityType: "admin_transfer", entityId: id, summary: `${ctx.user.name} é o novo administrador principal.` }, tx);
    });
    return { ok: true };
  });

  /* ---------------- Pesquisa global (respeita tenant e permissões) ---------------- */

  app.get("/api/search", async (req) => {
    const ctx = requireCtx(req);
    if (!ctx.caps.read) return { results: [] };
    const { q } = parse(z.object({ q: z.string().trim().min(2).max(80) }), req.query);
    const like = `%${q}%`;
    const results: { type: string; id: string; title: string; link: string }[] = [];
    const { customers, products } = await import("../db/schema.js");
    if (can(ctx, "crm.view")) {
      const r = await db.select({ id: customers.id, name: customers.name }).from(customers).where(and(eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt), ilike(customers.name, like))).limit(5);
      results.push(...r.map((x) => ({ type: "Cliente", id: x.id, title: x.name, link: `/app/customers?highlight=${x.id}` })));
    }
    if (can(ctx, "inventory.view")) {
      const r = await db.select({ id: products.id, name: products.name, sku: products.sku }).from(products)
        .where(and(eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt), or(ilike(products.name, like), ilike(products.sku, like)))).limit(5);
      results.push(...r.map((x) => ({ type: "Produto", id: x.id, title: `${x.sku} · ${x.name}`, link: `/app/products?highlight=${x.id}` })));
    }
    if (can(ctx, "employees.view")) {
      const r = await db.select({ id: employees.id, name: employees.fullName }).from(employees).where(and(eq(employees.tenantId, ctx.tenant.id), isNull(employees.deletedAt), branchCondition(ctx, employees.branchId), ilike(employees.fullName, like))).limit(5);
      results.push(...r.map((x) => ({ type: "Funcionário", id: x.id, title: x.name, link: `/app/employees?highlight=${x.id}` })));
    }
    return { results };
  });

  void dsql;
}

export async function disableMembership(ctx: Ctx, membershipId: string, summary: string) {
  await db.transaction(async (tx) => {
    const now = new Date();
    await tx.update(memberships).set({ status: "disabled", disabledAt: now }).where(and(eq(memberships.id, membershipId), eq(memberships.tenantId, ctx.tenant.id)));
    await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.membershipId, membershipId), isNull(sessions.revokedAt)));
    await audit({ ...auditBase(ctx), action: "user.disabled", entityType: "membership", entityId: membershipId, summary }, tx);
  });
  void isAdmin;
}
