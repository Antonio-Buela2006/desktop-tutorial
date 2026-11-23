import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { aiActions, aiCreditTransactions, aiPolicies, aiRequests, aiWallets, memberships, users } from "../db/schema.js";
import { audit } from "../core/audit.js";
import { auditBase, authorize, can, requireCtx } from "../core/context.js";
import { forbidden } from "../core/errors.js";
import { parse, uuidParam } from "../core/http.js";
import { chat, decideAction, getPolicy, chargeCredits } from "./orchestrator.js";
import { toolsFor, toolByName } from "./tools.js";
import { getSetting } from "../modules/billing.routes.js";

export async function aiRoutes(app: FastifyInstance) {
  app.post("/api/ai/chat", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req) => {
    const ctx = requireCtx(req);
    const body = parse(z.object({ message: z.string().trim().min(1).max(2000), locale: z.enum(["pt", "en"]).optional() }), req.body);
    return chat(ctx, body.message, body.locale ?? ctx.user.locale);
  });

  /** Execução direta de uma ferramenta de leitura (ex.: assistente contextual dentro de um módulo). */
  app.post("/api/ai/tools/:name", async (req) => {
    const ctx = requireCtx(req);
    const { name } = parse(z.object({ name: z.string() }), req.params);
    const policy = await getPolicy(ctx.tenant.id);
    authorize(ctx, "ai.use", "read");
    if (!policy.enabled) throw forbidden("A IA está desativada pela sua empresa.", "AI_DISABLED");
    const tool = toolByName(name);
    if (!tool || tool.sensitivity !== "read" || !toolsFor(ctx, policy).includes(tool)) throw forbidden();
    const input = tool.schema.parse(req.body ?? {});
    const costs = await getSetting<Record<string, number>>("ai_costs", {});
    await chargeCredits(ctx, costs[tool.costKey] ?? 1, tool.name, tool.module, "local");
    await audit({ ...auditBase(ctx), actorType: "ai", action: "ai.tool", summary: `Ferramenta de IA "${tool.name}" executada.` });
    return tool.run(ctx, input);
  });

  app.get("/api/ai/actions", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "ai.use", "read");
    const { status } = parse(z.object({ status: z.enum(["pending", "executed", "rejected", "failed", "all"]).default("pending") }), req.query);
    const mine = !can(ctx, "ai.approve");
    const rows = await db
      .select({ a: aiActions, requester: users.name })
      .from(aiActions)
      .innerJoin(memberships, eq(memberships.id, aiActions.requestedBy))
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(aiActions.tenantId, ctx.tenant.id), status === "all" ? undefined : eq(aiActions.status, status), mine ? eq(aiActions.requestedBy, ctx.membership.id) : undefined))
      .orderBy(desc(aiActions.createdAt))
      .limit(100);
    return rows.map((r) => ({ ...r.a, requester: r.requester, canDecide: can(ctx, "ai.approve") && !(r.a.sensitivity === "sensitive" && r.a.requestedBy === ctx.membership.id) }));
  });

  app.post("/api/ai/actions/:id/decision", async (req) => {
    const ctx = requireCtx(req);
    const { id } = parse(uuidParam, req.params);
    const { decision } = parse(z.object({ decision: z.enum(["approve", "reject"]) }), req.body);
    return decideAction(ctx, id, decision);
  });

  app.post("/api/ai/actions/:id/cancel", async (req) => {
    const ctx = requireCtx(req);
    const { id } = parse(uuidParam, req.params);
    const r = await db.update(aiActions).set({ status: "canceled", decidedAt: new Date(), decidedBy: ctx.membership.id })
      .where(and(eq(aiActions.id, id), eq(aiActions.tenantId, ctx.tenant.id), eq(aiActions.requestedBy, ctx.membership.id), eq(aiActions.status, "pending"))).returning();
    if (!r.length) throw forbidden();
    await audit({ ...auditBase(ctx), action: "ai.action_canceled", entityType: "ai_action", entityId: id, summary: "Ação da IA cancelada pelo requerente." });
    return { ok: true };
  });

  app.get("/api/ai/history", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "ai.use", "read");
    const all = can(ctx, "audit.view");
    return db.select().from(aiRequests).where(and(eq(aiRequests.tenantId, ctx.tenant.id), all ? undefined : eq(aiRequests.membershipId, ctx.membership.id))).orderBy(desc(aiRequests.createdAt)).limit(50);
  });

  app.get("/api/ai/usage", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "ai.use", "read");
    const [wallet] = await db.select().from(aiWallets).where(eq(aiWallets.tenantId, ctx.tenant.id));
    const since = new Date(Date.now() - 30 * 86400_000);
    const byOp = await db.select({ operation: aiCreditTransactions.operation, used: sum(aiCreditTransactions.amount) }).from(aiCreditTransactions)
      .where(and(eq(aiCreditTransactions.tenantId, ctx.tenant.id), gte(aiCreditTransactions.createdAt, since))).groupBy(aiCreditTransactions.operation);
    const byUser = await db.select({ name: users.name, used: sum(aiCreditTransactions.amount) }).from(aiCreditTransactions)
      .innerJoin(memberships, eq(memberships.id, aiCreditTransactions.membershipId)).innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(aiCreditTransactions.tenantId, ctx.tenant.id), gte(aiCreditTransactions.createdAt, since))).groupBy(users.name);
    const consumed = -byOp.filter((o) => o.operation !== "purchase" && o.operation !== "monthly_allowance").reduce((s, o) => s + Number(o.used ?? 0), 0);
    const perDay = consumed / 30;
    const policy = await getPolicy(ctx.tenant.id);
    return {
      wallet,
      consumedLast30Days: consumed,
      byOperation: byOp.map((o) => ({ operation: o.operation, credits: -Number(o.used ?? 0) })),
      byUser: can(ctx, "ai.configure") || ctx.membership.level !== "member" ? byUser.map((u) => ({ name: u.name, credits: -Number(u.used ?? 0) })) : [],
      depletionForecastDays: perDay > 0 ? Math.floor(wallet.balance / perDay) : null,
      tools: toolsFor(ctx, policy).map((t) => ({ name: t.name, description: t.description, sensitivity: t.sensitivity })),
      policy: { enabled: policy.enabled, accessLevel: policy.accessLevel, autonomy: policy.autonomy },
    };
  });

  /* ---- Painel central de IA (administradores; secundários só se delegados) ---- */
  app.get("/api/ai/policy", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "ai.configure", "read");
    return getPolicy(ctx.tenant.id);
  });

  app.put("/api/ai/policy", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "ai.configure", "billing");
    const body = parse(
      z.object({
        enabled: z.boolean(),
        accessLevel: z.enum(["restricted", "custom", "general"]),
        allowedModules: z.array(z.string()).max(18),
        autonomy: z.enum(["suggest_only", "simple_auto"]),
        dualApprovalFinancial: z.boolean(),
        disabledModules: z.array(z.string()).max(18),
        languages: z.array(z.enum(["pt", "en"])).min(1),
        alertsEnabled: z.boolean(),
        learningEnabled: z.boolean(),
        delegatedTo: z.array(z.string().uuid()).max(20).optional(),
      }),
      req.body,
    );
    const before = await getPolicy(ctx.tenant.id);
    if (ctx.membership.level !== "primary_admin") {
      // Administrador secundário: só se tiver delegação e nunca altera a própria delegação.
      if (!before.delegatedTo.includes(ctx.membership.id)) throw forbidden("A configuração da IA não lhe foi delegada pelo administrador principal.");
      if (body.delegatedTo && JSON.stringify([...body.delegatedTo].sort()) !== JSON.stringify([...before.delegatedTo].sort())) throw forbidden("Só o administrador principal gere delegações.");
    }
    const { delegatedTo, ...rest } = body;
    await db.update(aiPolicies).set({ ...rest, ...(delegatedTo && ctx.membership.level === "primary_admin" ? { delegatedTo } : {}), updatedAt: new Date() }).where(eq(aiPolicies.tenantId, ctx.tenant.id));
    await audit({ ...auditBase(ctx), action: "ai.policy_updated", entityType: "ai_policy", entityId: ctx.tenant.id, summary: "Política de IA atualizada.", metadata: { before, after: body } });
    return { ok: true };
  });
}
