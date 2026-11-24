/** Subscrição, planos, módulos, capacidade, cancelamento, faturas e pagamentos. */
import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx } from "../db/client.js";
import {
  aiWallets,
  invoices,
  moduleCatalog,
  payments,
  plans,
  platformSettings,
  subscriptions,
  tenantModules,
  tenants,
  webhookEvents,
  type InvoiceLine,
} from "../db/schema.js";
import { audit } from "../core/audit.js";
import { auditBase, authorize, oldestUnpaidDueAt, requireCtx, type Ctx } from "../core/context.js";
import { hmacSha256, randomToken, safeEqual } from "../core/crypto.js";
import { AppError, badRequest, forbidden, notFound } from "../core/errors.js";
import { parse, uuidParam } from "../core/http.js";
import {
  daysOverdue,
  dependents,
  effectiveLimits,
  isWithinFreeSwapWindow,
  limitViolations,
  missingDependencies,
  prorate,
  DAY,
} from "../core/subscription.js";
import { activateSubscription, catalogDeps, getPlanByCode, limitsOf, nextInvoiceNumber, priceSubscription, usageOf, validateModuleSelection } from "../core/tenantService.js";
import { purgeBusinessData } from "../core/demoData.js";
import { config } from "../config.js";
import { buildInvoicePdf, docLocale } from "../core/documents.js";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [r] = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
  return (r?.value as T) ?? fallback;
}

async function issueInvoice(tx: DbOrTx, tenantId: string, kind: string, lines: InvoiceLine[], meta: Record<string, unknown>, dueDays = 3, currency = "AOA") {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;
  const isCredit = subtotal < 0;
  const [inv] = await tx
    .insert(invoices)
    .values({
      tenantId,
      number: nextInvoiceNumber(),
      kind: isCredit ? "credit_note" : kind,
      status: isCredit || subtotal === 0 ? "paid" : "issued",
      currency,
      lines,
      subtotal,
      total: subtotal,
      amountPaid: isCredit || subtotal === 0 ? subtotal : 0,
      dueAt: new Date(Date.now() + dueDays * DAY),
      paidAt: isCredit || subtotal === 0 ? new Date() : null,
      meta,
    })
    .returning();
  return inv;
}

async function loadSub(tenantId: string, tx: DbOrTx = db) {
  const [row] = await tx.select({ s: subscriptions, p: plans }).from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId)).where(eq(subscriptions.tenantId, tenantId));
  return row;
}

/** Diferença mensal de preço ao alterar o conjunto de módulos (franquia do plano considerada). */
function modulesMonthlyCost(plan: typeof plans.$inferSelect, active: (typeof moduleCatalog.$inferSelect)[]) {
  const included = plan.includedModules ?? active.length;
  return active.slice(included).reduce((s, m) => s + (m.priceMonthly ?? plan.extraModulePrice ?? 0), 0);
}

async function modulePlan(ctx: Ctx, add: string[], remove: string[]) {
  const { rows, deps } = await catalogDeps();
  const current = new Set(ctx.modules);
  for (const r of remove) if (!current.has(r)) throw badRequest(`O módulo "${r}" não está ativo.`);
  const next = new Set([...current].filter((c) => !remove.includes(c)));
  for (const a of add) {
    const m = rows.find((r) => r.code === a);
    if (!m || m.status !== "active") throw badRequest(`O módulo "${a}" não está disponível para contratação.`);
    next.add(a);
  }
  const problems: string[] = [];
  for (const r of remove) {
    const dep = dependents(r, next, deps);
    if (dep.length) problems.push(`Não pode desativar "${r}": é dependência de ${dep.join(", ")}. Desative também esses módulos ou mantenha-o.`);
  }
  for (const a of next) {
    const missing = missingDependencies(a, next, deps);
    if (missing.length) problems.push(`"${a}" requer ${missing.join(", ")}.`);
  }
  const ordered = (set: Set<string>) => rows.filter((r) => set.has(r.code)).sort((a, b) => a.sortOrder - b.sortOrder);
  const now = new Date();
  const free = isWithinFreeSwapWindow(ctx.subscription.moduleSwapWindowEndsAt, now) || ctx.subscription.status === "trial";
  const delta = modulesMonthlyCost(ctx.plan, ordered(next)) - modulesMonthlyCost(ctx.plan, ordered(current));
  const months = ctx.subscription.billingCycle === "yearly" ? 12 : 1;
  let amount = 0;
  if (!free && ctx.subscription.currentPeriodStart && ctx.subscription.currentPeriodEnd)
    amount = prorate(delta * months, ctx.subscription.currentPeriodStart, ctx.subscription.currentPeriodEnd, now);
  return { next: [...next], problems, freeSwap: free, monthlyDelta: delta, prorated: amount, swapWindowEndsAt: ctx.subscription.moduleSwapWindowEndsAt };
}

export async function billingRoutes(app: FastifyInstance) {
  app.get("/api/billing/overview", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.view", "billing");
    const now = new Date();
    const catalog = await db.select().from(moduleCatalog).orderBy(moduleCatalog.sortOrder);
    const tm = await db.select().from(tenantModules).where(eq(tenantModules.tenantId, ctx.tenant.id));
    const invs = await db.select().from(invoices).where(eq(invoices.tenantId, ctx.tenant.id)).orderBy(desc(invoices.issuedAt)).limit(50);
    const [wallet] = await db.select().from(aiWallets).where(eq(aiWallets.tenantId, ctx.tenant.id));
    const allPlans = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.sortOrder);
    return {
      subscription: ctx.subscription,
      plan: ctx.plan,
      accessState: ctx.accessState,
      caps: ctx.caps,
      daysOverdue: daysOverdue(await oldestUnpaidDueAt(ctx.tenant.id), now),
      freeSwapWindow: isWithinFreeSwapWindow(ctx.subscription.moduleSwapWindowEndsAt, now),
      limits: await limitsOf(ctx.tenant.id),
      usage: await usageOf(ctx.tenant.id),
      modules: catalog.map((m) => ({ ...m, tenantStatus: tm.find((t) => t.moduleCode === m.code)?.status ?? null })),
      invoices: invs.map((i) => ({ ...i, overdue: ["issued", "partially_paid"].includes(i.status) && i.dueAt < now })),
      aiWallet: wallet,
      aiCreditPacks: await getSetting("ai_credit_packs", [] as { code: string; credits: number; price: number }[]),
      plans: allPlans,
      providers: await getSetting("payment_providers", { sandbox: true }),
      isDemo: ctx.tenant.isDemo,
    };
  });

  /* ---- Alteração de plano (upgrade/downgrade com pré-visualização) ---- */
  async function planPreview(ctx: Ctx, planCode: string) {
    const target = await getPlanByCode(planCode);
    const usage = await usageOf(ctx.tenant.id);
    const limits = effectiveLimits(target, ctx.subscription.extraUsers, ctx.subscription.extraEmployees);
    const violations = limitViolations(limits, usage);
    let prorated = 0;
    const months = ctx.subscription.billingCycle === "yearly" ? 12 : 1;
    if (ctx.subscription.status === "active" && ctx.subscription.currentPeriodStart && ctx.subscription.currentPeriodEnd) {
      if (target.priceMonthly === null || ctx.plan.priceMonthly === null) throw new AppError(422, "PRICE_PENDING", "Preço do plano ainda por definir.");
      prorated = prorate((target.priceMonthly - ctx.plan.priceMonthly) * months, ctx.subscription.currentPeriodStart, ctx.subscription.currentPeriodEnd, new Date());
    }
    return { target, limits, usage, violations, prorated, direction: (target.sortOrder ?? 0) > (ctx.plan.sortOrder ?? 0) ? "upgrade" : "downgrade" };
  }

  app.post("/api/billing/plan/preview", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.manage", "billing");
    const { planCode } = parse(z.object({ planCode: z.string() }), req.body);
    const p = await planPreview(ctx, planCode);
    return {
      ...p,
      policy: p.violations.length
        ? "Os dados existentes não são apagados. Enquanto estiver acima dos limites, a criação de novos registos/contas nessa categoria fica bloqueada até regularizar."
        : null,
    };
  });

  app.post("/api/billing/plan/change", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.manage", "billing");
    const { planCode } = parse(z.object({ planCode: z.string(), confirm: z.literal(true) }), req.body);
    if (ctx.plan.code === planCode) throw badRequest("Já está neste plano.");
    const p = await planPreview(ctx, planCode);
    const inv = await db.transaction(async (tx) => {
      await tx.update(subscriptions).set({ planId: p.target.id, updatedAt: new Date() }).where(eq(subscriptions.tenantId, ctx.tenant.id));
      let invoice = null;
      if (p.prorated !== 0)
        invoice = await issueInvoice(tx, ctx.tenant.id, "adjustment", [{ description: `Ajuste proporcional: ${ctx.plan.name} → ${p.target.name}`, quantity: 1, unitPrice: p.prorated, total: p.prorated }], { planChange: { from: ctx.plan.code, to: p.target.code } }, 3, p.target.currency);
      await tx.update(aiWallets).set({ monthlyAllowance: p.target.aiCreditsMonthly ?? 0 }).where(eq(aiWallets.tenantId, ctx.tenant.id));
      await audit({ ...auditBase(ctx), action: "subscription.plan_changed", entityType: "subscription", entityId: ctx.subscription.id, summary: `Plano alterado de ${ctx.plan.name} para ${p.target.name} (${p.direction}).`, metadata: { prorated: p.prorated, violations: p.violations } }, tx);
      return invoice;
    });
    return { ok: true, invoice: inv, violations: p.violations };
  });

  /* ---- Módulos: troca gratuita nos primeiros 7 dias; depois proporcional ---- */
  const modulesBody = z.object({ add: z.array(z.string()).max(18).default([]), remove: z.array(z.string()).max(18).default([]) });

  app.post("/api/billing/modules/preview", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.manage", "billing");
    const body = parse(modulesBody, req.body);
    return modulePlan(ctx, body.add, body.remove);
  });

  app.post("/api/billing/modules/apply", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.manage", "billing");
    const body = parse(modulesBody.extend({ confirm: z.literal(true) }), req.body);
    const plan = await modulePlan(ctx, body.add, body.remove);
    if (plan.problems.length) throw new AppError(409, "MODULE_DEPENDENCIES", "Alteração de módulos com conflitos de dependências.", { problems: plan.problems });
    const now = new Date();
    const invoice = await db.transaction(async (tx) => {
      for (const code of body.remove)
        // Desativação comercial: bloqueia o acesso, NUNCA apaga dados.
        await tx.update(tenantModules).set({ status: "inactive", deactivatedAt: now }).where(and(eq(tenantModules.tenantId, ctx.tenant.id), eq(tenantModules.moduleCode, code)));
      for (const code of body.add)
        await tx
          .insert(tenantModules)
          .values({ tenantId: ctx.tenant.id, moduleCode: code, status: "active", source: "included", activatedAt: now })
          .onConflictDoUpdate({ target: [tenantModules.tenantId, tenantModules.moduleCode], set: { status: "active", deactivatedAt: null, activatedAt: now } });
      let inv = null;
      if (plan.prorated !== 0)
        inv = await issueInvoice(tx, ctx.tenant.id, "adjustment", [{ description: `Ajuste proporcional de módulos (+${body.add.join(", ") || "—"} / -${body.remove.join(", ") || "—"})`, quantity: 1, unitPrice: plan.prorated, total: plan.prorated }], { modules: body }, 3, ctx.plan.currency);
      await audit({ ...auditBase(ctx), action: "subscription.modules_changed", entityType: "subscription", entityId: ctx.subscription.id, summary: `Módulos alterados${plan.freeSwap ? " (sem custo — janela inicial)" : ""}.`, metadata: { ...body, prorated: plan.prorated } }, tx);
      return inv;
    });
    return { ok: true, invoice, freeSwap: plan.freeSwap };
  });

  /* ---- Capacidade adicional (utilizadores individualmente ou em pacotes) ---- */
  app.post("/api/billing/capacity", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.manage", "billing");
    const body = parse(z.object({ extraUsers: z.number().int().min(0).max(1000).default(0), extraEmployees: z.number().int().min(0).max(10000).default(0) }), req.body);
    if (!body.extraUsers && !body.extraEmployees) throw badRequest("Indique a capacidade a adicionar.");
    if (ctx.subscription.status === "trial") throw badRequest("Durante a demonstração a capacidade é ampla; adicione capacidade após converter para plano pago.");
    const months = ctx.subscription.billingCycle === "yearly" ? 12 : 1;
    const unit = (ctx.plan.extraUserPrice ?? 0) * months;
    const amount = ctx.subscription.currentPeriodStart && ctx.subscription.currentPeriodEnd ? prorate(unit * body.extraUsers, ctx.subscription.currentPeriodStart, ctx.subscription.currentPeriodEnd, new Date()) : unit * body.extraUsers;
    const inv = await db.transaction(async (tx) => {
      // A capacidade só fica disponível após pagamento (aplicada no handler de fatura paga).
      const i = await issueInvoice(tx, ctx.tenant.id, "addon", [{ description: `Utilizadores adicionais (${body.extraUsers}) e funcionários adicionais (${body.extraEmployees}) — proporcional`, quantity: 1, unitPrice: amount, total: amount }], { capacity: body }, 3, ctx.plan.currency);
      await audit({ ...auditBase(ctx), action: "subscription.capacity_requested", entityType: "invoice", entityId: i.id, summary: `Pedido de capacidade adicional: +${body.extraUsers} utilizadores, +${body.extraEmployees} funcionários.` }, tx);
      return i;
    });
    if (inv.status === "paid") await onInvoicePaid(inv.id);
    return { invoice: inv };
  });

  /* ---- Créditos de IA (nunca cobrados automaticamente) ---- */
  app.post("/api/billing/ai-credits", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.manage", "billing");
    const { packCode } = parse(z.object({ packCode: z.string(), authorize: z.literal(true) }), req.body);
    const packs = await getSetting("ai_credit_packs", [] as { code: string; credits: number; price: number }[]);
    const pack = packs.find((p) => p.code === packCode);
    if (!pack) throw badRequest("Pacote inválido.");
    const inv = await db.transaction((tx) => issueInvoice(tx, ctx.tenant.id, "addon", [{ description: `Pacote de ${pack.credits} créditos de IA`, quantity: 1, unitPrice: pack.price, total: pack.price }], { aiCredits: pack.credits }, 3, ctx.plan.currency));
    await audit({ ...auditBase(ctx), action: "ai.credits_purchase_requested", entityType: "invoice", entityId: inv.id, summary: `Compra explícita de ${pack.credits} créditos de IA autorizada.` });
    return { invoice: inv };
  });

  /* ---- Cancelamento: acesso até ao fim do período pago ---- */
  app.post("/api/billing/cancel", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.manage", "billing");
    parse(z.object({ confirm: z.literal(true), reason: z.string().max(500).optional() }), req.body);
    if (ctx.subscription.status !== "active") throw badRequest("Só é possível cancelar uma subscrição ativa.");
    await db.update(subscriptions).set({ cancelAtPeriodEnd: true, canceledAt: new Date(), updatedAt: new Date() }).where(eq(subscriptions.tenantId, ctx.tenant.id));
    await audit({ ...auditBase(ctx), action: "subscription.cancel_scheduled", entityType: "subscription", entityId: ctx.subscription.id, summary: `Cancelamento agendado para ${ctx.subscription.currentPeriodEnd?.toISOString().slice(0, 10)}.` });
    return { ok: true, accessUntil: ctx.subscription.currentPeriodEnd };
  });

  app.post("/api/billing/resume", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.manage", "billing");
    if (!ctx.subscription.cancelAtPeriodEnd || ctx.accessState === "canceled") throw badRequest("Nada para retomar.");
    await db.update(subscriptions).set({ cancelAtPeriodEnd: false, canceledAt: null }).where(eq(subscriptions.tenantId, ctx.tenant.id));
    await audit({ ...auditBase(ctx), action: "subscription.cancel_reverted", entityType: "subscription", entityId: ctx.subscription.id, summary: "Cancelamento revertido." });
    return { ok: true };
  });

  /* ---- Conversão do trial para plano pago ---- */
  app.post("/api/billing/convert", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.manage", "billing");
    const body = parse(
      z.object({ planCode: z.string(), modules: z.array(z.string()).min(1).max(18), billingCycle: z.enum(["monthly", "yearly"]).default("monthly"), extraUsers: z.number().int().min(0).default(0), purgeDemoData: z.boolean() }),
      req.body,
    );
    if (!["trial"].includes(ctx.subscription.status) && ctx.accessState !== "expired" && ctx.accessState !== "canceled") throw badRequest("A conversão aplica-se a demonstrações ou subscrições terminadas.");
    const plan = await getPlanByCode(body.planCode);
    const selected = await validateModuleSelection(body.modules);
    const pricing = priceSubscription(plan, selected, body.billingCycle, body.extraUsers, 0);
    const inv = await db.transaction((tx) =>
      issueInvoice(tx, ctx.tenant.id, "subscription", pricing.lines, { apply: { planCode: plan.code, modules: body.modules, billingCycle: body.billingCycle, extraUsers: body.extraUsers, purgeDemoData: body.purgeDemoData } }, 3, plan.currency),
    );
    await audit({ ...auditBase(ctx), action: "subscription.conversion_requested", entityType: "invoice", entityId: inv.id, summary: `Conversão para ${plan.name} pedida; ativação após pagamento.` });
    return { invoice: inv };
  });

  /* ---- Faturas e pagamento ---- */
  app.get("/api/billing/invoices/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.view", "billing");
    const { id } = parse(uuidParam, req.params);
    const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenant.id)));
    if (!inv) throw notFound();
    const pays = await db.select().from(payments).where(and(eq(payments.invoiceId, id), eq(payments.tenantId, ctx.tenant.id)));
    return { invoice: inv, payments: pays.map(({ checkoutToken: _c, ...p }) => p), company: { name: ctx.tenant.name, taxId: ctx.tenant.taxId } };
  });

  app.get("/api/billing/invoices/:id/pdf", async (req, reply) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.view", "billing");
    const { id } = parse(uuidParam, req.params);
    const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenant.id)));
    if (!inv) throw notFound();
    const pdf = await buildInvoicePdf(inv, { name: ctx.tenant.legalName || ctx.tenant.name, taxId: ctx.tenant.taxId }, docLocale(ctx.user.locale));
    reply.header("content-type", "application/pdf").header("content-disposition", `attachment; filename="fatura-${inv.number}.pdf"`).header("cache-control", "private, no-store");
    return pdf;
  });

  app.post("/api/billing/invoices/:id/pay", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "billing.manage", "billing");
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ provider: z.enum(["sandbox", "bank_transfer", "multicaixa_express"]), idempotencyKey: z.string().min(8).max(80) }), req.body);
    const providers = await getSetting<Record<string, boolean>>("payment_providers", { sandbox: true });
    if (!providers[body.provider]) throw new AppError(422, "PROVIDER_UNAVAILABLE", "Este meio de pagamento ainda não está disponível (integração pendente de validação comercial).");
    if (body.provider === "sandbox" && config.isProd) throw forbidden("O fornecedor sandbox não está disponível em produção.");
    const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenant.id), inArray(invoices.status, ["issued", "partially_paid"])));
    if (!inv) throw notFound("Fatura não encontrada ou já paga.");
    // Idempotência: o mesmo pedido repetido devolve o mesmo pagamento.
    const [existing] = await db.select().from(payments).where(and(eq(payments.idempotencyKey, `${ctx.tenant.id}:${body.idempotencyKey}`)));
    if (existing) {
      if (existing.invoiceId !== inv.id) throw badRequest("Chave de idempotência já utilizada.");
      return paymentResponse(existing);
    }
    const ref = `${body.provider === "bank_transfer" ? "TRF" : "PAY"}-${randomToken(9).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
    const [p] = await db
      .insert(payments)
      .values({ tenantId: ctx.tenant.id, invoiceId: inv.id, provider: body.provider, providerRef: ref, idempotencyKey: `${ctx.tenant.id}:${body.idempotencyKey}`, amount: Math.round((inv.total - inv.amountPaid) * 100) / 100, checkoutToken: body.provider === "sandbox" ? randomToken() : null })
      .returning();
    await audit({ ...auditBase(ctx), action: "payment.initiated", entityType: "payment", entityId: p.id, summary: `Pagamento iniciado (${body.provider}) para a fatura ${inv.number}.` });
    return paymentResponse(p);
  });

  function paymentResponse(p: typeof payments.$inferSelect) {
    if (p.provider === "sandbox") return { paymentId: p.id, provider: p.provider, status: p.status, checkoutUrl: `/checkout/sandbox?token=${p.checkoutToken}` };
    return {
      paymentId: p.id,
      provider: p.provider,
      status: p.status,
      reference: p.providerRef,
      instructions: "Efetue a transferência indicando a referência no descritivo. A Nexora confirma a receção (reconciliação) e a subscrição é ativada automaticamente. Dados bancários: PENDENTE de configuração pela Nexora.",
    };
  }

  /* ---- Checkout sandbox: simula o fornecedor, que nos chama via webhook assinado ---- */
  app.get("/api/payments/sandbox/:token", async (req) => {
    const { token } = parse(z.object({ token: z.string().min(10) }), req.params);
    const [p] = await db.select({ p: payments, inv: invoices, t: tenants.name }).from(payments).innerJoin(invoices, eq(invoices.id, payments.invoiceId)).innerJoin(tenants, eq(tenants.id, payments.tenantId))
      .where(and(eq(payments.checkoutToken, token), eq(payments.provider, "sandbox")));
    if (!p) throw notFound();
    return { amount: p.p.amount, currency: p.inv.currency, invoice: p.inv.number, company: p.t, status: p.p.status };
  });

  app.post("/api/payments/sandbox/:token/complete", async (req) => {
    if (config.isProd) throw forbidden();
    const { token } = parse(z.object({ token: z.string().min(10) }), req.params);
    const { outcome } = parse(z.object({ outcome: z.enum(["succeeded", "failed"]) }), req.body);
    const [p] = await db.select().from(payments).where(and(eq(payments.checkoutToken, token), eq(payments.provider, "sandbox")));
    if (!p) throw notFound();
    const event = { id: `evt_${randomToken(10)}`, type: `payment.${outcome}`, data: { providerRef: p.providerRef, amount: p.amount } };
    const raw = JSON.stringify(event);
    // Entrega o evento ao nosso próprio endpoint de webhook (como faria o fornecedor real).
    const res = await app.inject({ method: "POST", url: "/api/webhooks/payments/sandbox", headers: { "content-type": "application/json", "x-nexora-signature": hmacSha256(config.paymentWebhookSecret, raw) }, payload: raw });
    return { delivered: res.statusCode === 200, result: res.json() };
  });

  /** Webhook do fornecedor: assinatura HMAC, idempotência por event id, reprocessamento seguro. */
  app.post("/api/webhooks/payments/:provider", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { provider } = parse(z.object({ provider: z.enum(["sandbox", "multicaixa_express", "bank_transfer"]) }), req.params);
    const raw = (req as any).rawBody as string | undefined;
    const sig = String(req.headers["x-nexora-signature"] ?? "");
    if (!raw || !sig || !safeEqual(sig, hmacSha256(config.paymentWebhookSecret, raw))) {
      reply.code(401);
      return { error: { code: "BAD_SIGNATURE", message: "Assinatura inválida." } };
    }
    const event = parse(z.object({ id: z.string().min(3), type: z.string(), data: z.object({ providerRef: z.string(), amount: z.number() }) }), JSON.parse(raw));
    return processPaymentEvent(provider, event);
  });
}

export async function processPaymentEvent(provider: string, event: { id: string; type: string; data: { providerRef: string; amount: number } }) {
  const inserted = await db.insert(webhookEvents).values({ provider, eventId: event.id, payload: event }).onConflictDoNothing().returning({ id: webhookEvents.id });
  if (!inserted.length) return { ok: true, duplicate: true };
  const [p] = await db.select().from(payments).where(and(eq(payments.providerRef, event.data.providerRef), eq(payments.provider, provider)));
  let result = "ignored";
  if (p && event.type === "payment.succeeded") result = await confirmPayment(p.id, event.data.amount, null);
  else if (p && event.type === "payment.failed" && p.status === "pending") {
    await db.update(payments).set({ status: "failed" }).where(eq(payments.id, p.id));
    await audit({ tenantId: p.tenantId, actorType: "system", action: "payment.failed", entityType: "payment", entityId: p.id, summary: "Pagamento falhado (fornecedor)." });
    result = "failed";
  }
  await db.update(webhookEvents).set({ processedAt: new Date(), result }).where(eq(webhookEvents.id, inserted[0].id));
  return { ok: true, result };
}

/** Confirma pagamento (webhook ou reconciliação manual) — idempotente. */
export async function confirmPayment(paymentId: string, amount: number, reconciledBy: string | null): Promise<string> {
  const paidInvoiceId = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p || p.status === "confirmed") return null;
    if (Math.abs(amount - p.amount) > 0.009) {
      await audit({ tenantId: p.tenantId, actorType: "system", action: "payment.amount_mismatch", entityType: "payment", entityId: p.id, summary: `Montante recebido (${amount}) difere do esperado (${p.amount}); requer reconciliação.` }, tx);
    }
    await tx.update(payments).set({ status: "confirmed", confirmedAt: new Date(), reconciledBy }).where(eq(payments.id, p.id));
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, p.invoiceId)).for("update");
    const paid = Math.round((inv.amountPaid + amount) * 100) / 100;
    const full = paid + 0.009 >= inv.total;
    await tx.update(invoices).set({ amountPaid: paid, status: full ? "paid" : "partially_paid", paidAt: full ? new Date() : null }).where(eq(invoices.id, inv.id));
    await audit({ tenantId: p.tenantId, actorType: reconciledBy ? "platform_admin" : "system", actorId: reconciledBy, action: "payment.confirmed", entityType: "payment", entityId: p.id, summary: `Pagamento de ${amount} confirmado (fatura ${inv.number}${full ? " liquidada" : " parcialmente paga"}).` }, tx);
    return full ? inv.id : null;
  });
  if (paidInvoiceId) await onInvoicePaid(paidInvoiceId);
  return paidInvoiceId ? "invoice_paid" : "payment_recorded";
}

/** Efeitos de uma fatura liquidada: ativação/renovação, capacidade e créditos de IA. */
export async function onInvoicePaid(invoiceId: string) {
  await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
    const meta = inv.meta as any;
    if (meta.applied) return;
    if (inv.kind === "subscription") {
      if (meta.apply) {
        const plan = await getPlanByCode(meta.apply.planCode, tx);
        if (meta.apply.purgeDemoData) await purgeBusinessData(inv.tenantId, tx);
        await tx.update(tenants).set({ isDemo: false }).where(eq(tenants.id, inv.tenantId));
        await tx.update(subscriptions).set({ planId: plan.id, billingCycle: meta.apply.billingCycle, extraUsers: meta.apply.extraUsers ?? 0, status: "expired" }).where(eq(subscriptions.tenantId, inv.tenantId));
        await tx.update(tenantModules).set({ status: "inactive", deactivatedAt: new Date() }).where(and(eq(tenantModules.tenantId, inv.tenantId), isNull(tenantModules.deactivatedAt)));
        for (const code of meta.apply.modules as string[])
          await tx.insert(tenantModules).values({ tenantId: inv.tenantId, moduleCode: code, status: "active", source: "included" })
            .onConflictDoUpdate({ target: [tenantModules.tenantId, tenantModules.moduleCode], set: { status: "active", deactivatedAt: null, source: "included" } });
      }
      await activateSubscription(inv.tenantId, tx);
    }
    if (meta.capacity) {
      const [s] = await tx.select().from(subscriptions).where(eq(subscriptions.tenantId, inv.tenantId));
      await tx.update(subscriptions).set({ extraUsers: s.extraUsers + (meta.capacity.extraUsers ?? 0), extraEmployees: s.extraEmployees + (meta.capacity.extraEmployees ?? 0) }).where(eq(subscriptions.id, s.id));
    }
    if (meta.aiCredits) {
      const [w] = await tx.select().from(aiWallets).where(eq(aiWallets.tenantId, inv.tenantId));
      await tx.update(aiWallets).set({ balance: w.balance + meta.aiCredits }).where(eq(aiWallets.tenantId, inv.tenantId));
      const { aiCreditTransactions } = await import("../db/schema.js");
      await tx.insert(aiCreditTransactions).values({ tenantId: inv.tenantId, amount: meta.aiCredits, operation: "purchase", reason: `Fatura ${inv.number}` });
    }
    await tx.update(invoices).set({ meta: { ...meta, applied: true } }).where(eq(invoices.id, inv.id));
  });
}

export { issueInvoice, loadSub };
