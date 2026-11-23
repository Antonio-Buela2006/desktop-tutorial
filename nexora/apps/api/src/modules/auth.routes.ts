import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, asc, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { db } from "../db/client.js";
import { invitations, memberships, membershipRoles, passwordResets, roles, sessions, tenants, users } from "../db/schema.js";
import { audit } from "../core/audit.js";
import { decrypt, encrypt, hashPassword, passwordProblems, randomToken, sha256, verifyPassword } from "../core/crypto.js";
import { AppError, badRequest, notFound, unauthorized } from "../core/errors.js";
import { clientInfo, parse, setSessionCookie } from "../core/http.js";
import { SESSION_COOKIE, requireCtx, auditBase } from "../core/context.js";
import { assertCapacity, createTenant } from "../core/tenantService.js";
import { seedDemoData } from "../core/demoData.js";
import { notifyMembership, sendMail } from "../core/notify.js";
import { config } from "../config.js";
import { assertIpAllowed, recordAuthFailure } from "../core/ipguard.js";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

async function startSession(req: FastifyRequest, reply: FastifyReply, user: typeof users.$inferSelect, membership: typeof memberships.$inferSelect) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, membership.tenantId));
  const token = randomToken();
  const { ip, userAgent } = clientInfo(req);
  const now = new Date();
  // Novo dispositivo? (alerta de acesso)
  const [seen] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, user.id), eq(sessions.userAgent, userAgent))).limit(1);
  const [s] = await db
    .insert(sessions)
    .values({
      tokenHash: sha256(token),
      userId: user.id,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      mfaVerified: false,
      ip,
      userAgent,
      expiresAt: new Date(now.getTime() + config.sessionTtlHours * 3600_000),
    })
    .returning();
  // Limite de dispositivos/sessões por utilizador: termina as mais antigas.
  const active = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, user.id), eq(sessions.tenantId, membership.tenantId), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.createdAt));
  const max = tenant.settings.maxSessionsPerUser ?? 5;
  for (const old of active.slice(max)) await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, old.id));
  if (!seen) {
    await notifyMembership(membership.tenantId, membership.id, {
      type: "security.new_device",
      severity: "warning",
      title: "Novo dispositivo com acesso à sua conta",
      body: `Início de sessão a partir de ${userAgent || "dispositivo desconhecido"} (IP ${ip}). Se não foi você, termine a sessão e altere a palavra-passe.`,
      link: "/app/security",
    });
  }
  setSessionCookie(reply, SESSION_COOKIE, token, config.sessionTtlHours * 3600);
  return s;
}

const signupSchema = z.object({
  company: z.object({
    name: z.string().trim().min(2).max(120),
    legalName: z.string().trim().max(160).optional(),
    taxId: z.string().trim().max(40).optional(),
    country: z.string().length(2).default("AO"),
    locale: z.enum(["pt", "en"]).default("pt"),
  }),
  admin: z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(160), password: z.string().max(200) }),
  planCode: z.string(),
  modules: z.array(z.string()).max(18).default([]),
  mode: z.enum(["trial", "paid"]),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  extraUsers: z.number().int().min(0).max(1000).default(0),
  extraEmployees: z.number().int().min(0).max(10000).default(0),
  acceptTerms: z.literal(true),
});

export async function authRoutes(app: FastifyInstance) {
  const loginLimit = { config: { rateLimit: { max: config.isTest ? 1000 : 10, timeWindow: "1 minute" } } };

  app.post("/api/auth/signup", loginLimit, async (req, reply) => {
    const body = parse(signupSchema, req.body);
    const pwErr = passwordProblems(body.admin.password);
    if (pwErr) throw badRequest(pwErr, { fields: { "admin.password": pwErr } });
    const { tenant, user, membership, invoiceId } = await createTenant(body);
    if (body.mode === "trial") await db.transaction((tx) => seedDemoData(tenant.id, tx));
    await startSession(req, reply, user, membership);
    await sendMail(user.email, "Bem-vindo à Nexora", `A empresa ${tenant.name} foi registada.`);
    return { tenantId: tenant.id, invoiceId, mode: body.mode };
  });

  app.post("/api/auth/login", loginLimit, async (req, reply) => {
    const body = parse(z.object({ email: z.string().email(), password: z.string().max(200), tenantId: z.string().uuid().optional() }), req.body);
    assertIpAllowed(req.ip);
    const [user] = await db.select().from(users).where(eq(users.email, body.email.trim().toLowerCase()));
    const fail = () => new AppError(401, "INVALID_CREDENTIALS", "E-mail ou palavra-passe incorretos.");
    if (!user) {
      await verifyPassword(body.password, "$2a$04$invalidinvalidinvalidinOq3J0gYbZr9Pz0w0W8b3nR9gk2Y6Vq"); // tempo constante
      await recordAuthFailure(req.ip, "login");
      throw fail();
    }
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new AppError(429, "ACCOUNT_LOCKED", "Demasiadas tentativas falhadas. Tente novamente mais tarde ou recupere a palavra-passe.");
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      const failed = user.failedLogins + 1;
      await db
        .update(users)
        .set({ failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
        .where(eq(users.id, user.id));
      await recordAuthFailure(req.ip, "login");
      if (failed >= MAX_FAILED) await audit({ tenantId: null, actorType: "system", action: "auth.account_locked", entityType: "user", entityId: user.id, summary: "Conta bloqueada temporariamente por tentativas falhadas.", ip: req.ip });
      throw fail();
    }
    await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id));
    const ms = await db.select({ m: memberships, t: tenants }).from(memberships).innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(and(eq(memberships.userId, user.id), eq(memberships.status, "active"))).orderBy(asc(memberships.createdAt));
    if (!ms.length) throw new AppError(403, "NO_ACTIVE_COMPANY", "A sua conta não tem acesso ativo a nenhuma empresa.");
    const chosen = body.tenantId ? ms.find((x) => x.m.tenantId === body.tenantId) : ms[0];
    if (!chosen) throw fail();
    await startSession(req, reply, user, chosen.m);
    await audit({ tenantId: chosen.m.tenantId, actorType: "user", actorId: chosen.m.id, action: "auth.login", summary: "Início de sessão.", ip: req.ip });
    const policy = chosen.t.settings.require2fa;
    return {
      mfaRequired: user.totpEnabled,
      mfaEnrollmentRequired: !user.totpEnabled && (policy === "all" || (policy === "admins" && chosen.m.level !== "member")),
      companies: ms.map((x) => ({ tenantId: x.t.id, name: x.t.name })),
    };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    if (req.nx) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, req.nx.sessionId));
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.post("/api/auth/switch-company", async (req, reply) => {
    const ctx = requireCtx(req);
    const { tenantId } = parse(z.object({ tenantId: z.string().uuid() }), req.body);
    const [m] = await db.select().from(memberships).where(and(eq(memberships.userId, ctx.user.id), eq(memberships.tenantId, tenantId), eq(memberships.status, "active")));
    if (!m) throw notFound();
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, ctx.sessionId));
    const s = await startSession(req, reply, ctx.user, m);
    // O fator 2FA já foi validado nesta autenticação.
    if (!ctx.mfaPending) await db.update(sessions).set({ mfaVerified: true }).where(eq(sessions.id, s.id));
    return { ok: true };
  });

  app.get("/api/auth/me", async (req) => {
    const ctx = req.nx;
    if (!ctx) throw unauthorized();
    const companies = await db.select({ tenantId: tenants.id, name: tenants.name }).from(memberships).innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(and(eq(memberships.userId, ctx.user.id), eq(memberships.status, "active")));
    return {
      user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, locale: ctx.user.locale, totpEnabled: ctx.user.totpEnabled },
      tenant: { id: ctx.tenant.id, name: ctx.tenant.name, isDemo: ctx.tenant.isDemo, currency: ctx.tenant.currency, settings: ctx.tenant.settings },
      membership: { id: ctx.membership.id, level: ctx.membership.level, branchScope: ctx.branchScope },
      permissions: [...ctx.permissions].sort(),
      modules: [...ctx.modules].sort(),
      subscription: {
        state: ctx.accessState,
        caps: ctx.caps,
        plan: { code: ctx.plan.code, name: ctx.plan.name },
        trialEndsAt: ctx.subscription.trialEndsAt,
        currentPeriodEnd: ctx.subscription.currentPeriodEnd,
        cancelAtPeriodEnd: ctx.subscription.cancelAtPeriodEnd,
      },
      mfaPending: ctx.mfaPending,
      mfaEnrollmentRequired: ctx.mfaEnrollmentRequired,
      companies,
    };
  });

  app.patch("/api/auth/me", async (req) => {
    const ctx = requireCtx(req);
    const body = parse(z.object({ name: z.string().trim().min(2).max(120).optional(), locale: z.enum(["pt", "en"]).optional() }), req.body);
    await db.update(users).set(body).where(eq(users.id, ctx.user.id));
    return { ok: true };
  });

  app.post("/api/auth/password", async (req) => {
    const ctx = requireCtx(req);
    const body = parse(z.object({ current: z.string(), next: z.string().max(200) }), req.body);
    if (!(await verifyPassword(body.current, ctx.user.passwordHash))) throw badRequest("Palavra-passe atual incorreta.");
    const err = passwordProblems(body.next);
    if (err) throw badRequest(err);
    await db.update(users).set({ passwordHash: await hashPassword(body.next) }).where(eq(users.id, ctx.user.id));
    await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, ctx.user.id), ne(sessions.id, ctx.sessionId)));
    await audit({ ...auditBase(ctx), action: "auth.password_changed", summary: "Palavra-passe alterada; outras sessões terminadas." });
    return { ok: true };
  });

  /* ---------------- 2FA (TOTP — Google/Microsoft Authenticator) ---------------- */

  async function checkTotp(user: typeof users.$inferSelect, code: string): Promise<"totp" | "recovery" | null> {
    const clean = code.replace(/\s/g, "");
    if (user.totpSecret && /^\d{6}$/.test(clean)) {
      const r = await verifyTotp({ secret: decrypt(user.totpSecret), token: clean, epochTolerance: 30 });
      if (r.valid) return "totp";
    }
    const h = sha256(clean.toUpperCase());
    if (user.recoveryCodes.includes(h)) {
      await db.update(users).set({ recoveryCodes: user.recoveryCodes.filter((c) => c !== h) }).where(eq(users.id, user.id));
      return "recovery";
    }
    return null;
  }

  app.post("/api/auth/2fa/verify", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req) => {
    const ctx = requireCtx(req, { allowMfaPending: true });
    const { code } = parse(z.object({ code: z.string().min(6).max(20) }), req.body);
    assertIpAllowed(req.ip);
    const kind = await checkTotp(ctx.user, code);
    if (!kind) await recordAuthFailure(req.ip, "2fa");
    if (!kind) throw new AppError(401, "INVALID_CODE", "Código inválido.");
    await db.update(sessions).set({ mfaVerified: true }).where(eq(sessions.id, ctx.sessionId));
    await audit({ ...auditBase(ctx), action: "auth.mfa_verified", summary: kind === "recovery" ? "2FA validado com código de recuperação." : "2FA validado." });
    return { ok: true };
  });

  app.post("/api/auth/2fa/setup", async (req) => {
    const ctx = requireCtx(req, { allowEnrollment: true });
    if (ctx.user.totpEnabled) throw badRequest("O 2FA já está ativo.");
    const secret = generateSecret();
    await db.update(users).set({ totpSecret: encrypt(secret) }).where(eq(users.id, ctx.user.id));
    const uri = generateURI({ issuer: "Nexora", label: ctx.user.email, secret });
    return { secret, uri, qr: await QRCode.toDataURL(uri) };
  });

  app.post("/api/auth/2fa/enable", async (req) => {
    const ctx = requireCtx(req, { allowEnrollment: true });
    const { code } = parse(z.object({ code: z.string().regex(/^\d{6}$/) }), req.body);
    const [u] = await db.select().from(users).where(eq(users.id, ctx.user.id));
    if (!u.totpSecret) throw badRequest("Inicie a configuração do 2FA primeiro.");
    const r = await verifyTotp({ secret: decrypt(u.totpSecret), token: code, epochTolerance: 30 });
    if (!r.valid) throw new AppError(401, "INVALID_CODE", "Código inválido.");
    const codes = Array.from({ length: 10 }, () => randomBytes(5).toString("hex").toUpperCase());
    await db.update(users).set({ totpEnabled: true, recoveryCodes: codes.map((c) => sha256(c)) }).where(eq(users.id, u.id));
    await db.update(sessions).set({ mfaVerified: true }).where(eq(sessions.id, ctx.sessionId));
    await audit({ ...auditBase(ctx), action: "auth.mfa_enabled", summary: "2FA ativado." });
    return { recoveryCodes: codes };
  });

  app.post("/api/auth/2fa/disable", async (req) => {
    const ctx = requireCtx(req);
    const body = parse(z.object({ password: z.string(), code: z.string() }), req.body);
    const policy = ctx.tenant.settings.require2fa;
    if (policy === "all" || (policy === "admins" && ctx.membership.level !== "member"))
      throw new AppError(403, "MFA_REQUIRED_BY_POLICY", "A política da empresa exige 2FA para a sua conta.");
    if (!(await verifyPassword(body.password, ctx.user.passwordHash)) || !(await checkTotp(ctx.user, body.code)))
      throw new AppError(401, "INVALID_CREDENTIALS", "Palavra-passe ou código inválidos.");
    await db.update(users).set({ totpEnabled: false, totpSecret: null, recoveryCodes: [] }).where(eq(users.id, ctx.user.id));
    await audit({ ...auditBase(ctx), action: "auth.mfa_disabled", summary: "2FA desativado." });
    return { ok: true };
  });

  /* ---------------- Sessões e dispositivos ---------------- */

  app.get("/api/auth/sessions", async (req) => {
    const ctx = requireCtx(req);
    const rows = await db
      .select({ id: sessions.id, ip: sessions.ip, userAgent: sessions.userAgent, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt })
      .from(sessions)
      .where(and(eq(sessions.userId, ctx.user.id), eq(sessions.tenantId, ctx.tenant.id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastSeenAt));
    return rows.map((r) => ({ ...r, current: r.id === ctx.sessionId }));
  });

  app.delete("/api/auth/sessions/:id", async (req) => {
    const ctx = requireCtx(req);
    const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
    const res = await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.id, id), eq(sessions.userId, ctx.user.id))).returning({ id: sessions.id });
    if (!res.length) throw notFound();
    await audit({ ...auditBase(ctx), action: "auth.session_revoked", entityType: "session", entityId: id, summary: "Sessão terminada remotamente." });
    return { ok: true };
  });

  /* ---------------- Recuperação de conta ---------------- */

  app.post("/api/auth/password/forgot", loginLimit, async (req) => {
    const { email } = parse(z.object({ email: z.string().email() }), req.body);
    const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (u) {
      const token = randomToken();
      await db.insert(passwordResets).values({ userId: u.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) });
      await sendMail(u.email, "Recuperação de palavra-passe", `Use este link (válido 30 min): ${config.webOrigin}/reset-password?token=${token}`);
    }
    // Resposta idêntica exista ou não a conta (evita enumeração).
    return { ok: true };
  });

  app.post("/api/auth/password/reset", loginLimit, async (req) => {
    const body = parse(z.object({ token: z.string().min(10), password: z.string().max(200) }), req.body);
    const err = passwordProblems(body.password);
    if (err) throw badRequest(err);
    const [r] = await db.select().from(passwordResets).where(and(eq(passwordResets.tokenHash, sha256(body.token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())));
    if (!r) throw badRequest("Link inválido ou expirado.");
    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, r.id));
    await db.update(users).set({ passwordHash: await hashPassword(body.password), failedLogins: 0, lockedUntil: null }).where(eq(users.id, r.userId));
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, r.userId));
    await audit({ tenantId: null, actorType: "user", actorId: r.userId, action: "auth.password_reset", summary: "Palavra-passe redefinida por link de recuperação; sessões terminadas.", ip: req.ip });
    return { ok: true };
  });

  /* ---------------- Convites ---------------- */

  app.get("/api/auth/invitations/:token", async (req) => {
    const { token } = parse(z.object({ token: z.string().min(10) }), req.params);
    const [inv] = await db.select({ i: invitations, t: tenants }).from(invitations).innerJoin(tenants, eq(tenants.id, invitations.tenantId))
      .where(and(eq(invitations.tokenHash, sha256(token)), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())));
    if (!inv) throw notFound("Convite inválido ou expirado.");
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, inv.i.email));
    return { company: inv.t.name, email: inv.i.email, name: inv.i.name, existingAccount: !!existing };
  });

  app.post("/api/auth/invitations/accept", loginLimit, async (req, reply) => {
    const body = parse(z.object({ token: z.string().min(10), password: z.string().max(200), name: z.string().trim().min(2).max(120).optional() }), req.body);
    const [inv] = await db.select().from(invitations)
      .where(and(eq(invitations.tokenHash, sha256(body.token)), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())));
    if (!inv) throw notFound("Convite inválido ou expirado.");
    const result = await db.transaction(async (tx) => {
      let [user] = await tx.select().from(users).where(eq(users.email, inv.email));
      if (user) {
        if (!(await verifyPassword(body.password, user.passwordHash))) throw new AppError(401, "INVALID_CREDENTIALS", "Palavra-passe incorreta para a conta existente.");
      } else {
        const err = passwordProblems(body.password);
        if (err) throw badRequest(err);
        [user] = await tx.insert(users).values({ email: inv.email, name: body.name ?? inv.name, passwordHash: await hashPassword(body.password) }).returning();
      }
      const [existingM] = await tx.select().from(memberships).where(and(eq(memberships.tenantId, inv.tenantId), eq(memberships.userId, user.id)));
      if (existingM?.status === "active") throw badRequest("Já é membro desta empresa.");
      await assertCapacity(inv.tenantId, "users", tx);
      if (inv.level === "secondary_admin") await assertCapacity(inv.tenantId, "secondaryAdmins", tx);
      const [m] = existingM
        ? await tx.update(memberships).set({ status: "active", level: inv.level, disabledAt: null, employeeId: inv.employeeId }).where(eq(memberships.id, existingM.id)).returning()
        : await tx.insert(memberships).values({ tenantId: inv.tenantId, userId: user.id, level: inv.level, employeeId: inv.employeeId }).returning();
      const validRoles = inv.roleIds.length
        ? (await tx.select({ id: roles.id }).from(roles).where(eq(roles.tenantId, inv.tenantId))).filter((r) => inv.roleIds.includes(r.id))
        : [];
      for (const r of validRoles) await tx.insert(membershipRoles).values({ tenantId: inv.tenantId, membershipId: m.id, roleId: r.id }).onConflictDoNothing();
      await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
      await audit({ tenantId: inv.tenantId, actorType: "user", actorId: m.id, action: "user.invitation_accepted", entityType: "membership", entityId: m.id, summary: `${user.email} aceitou o convite.` }, tx);
      return { user, m };
    });
    await startSession(req, reply, result.user, result.m);
    return { ok: true };
  });
}
