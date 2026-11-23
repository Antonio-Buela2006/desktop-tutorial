/**
 * Jobs periódicos (worker). V1: agendador em processo (ver ADR-0004);
 * interfaces preparadas para migrar para Redis/BullMQ quando a carga justificar.
 * Cada job é idempotente e opera tenant a tenant.
 */
import { and, eq, inArray, isNotNull, isNull, lt, lte, sql as dsql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  aiCreditTransactions,
  aiPolicies,
  aiWallets,
  customers,
  employees,
  financeTransactions,
  invoices,
  plans,
  products,
  subscriptions,
  tenants,
} from "../db/schema.js";
import { audit } from "../core/audit.js";
import { oldestUnpaidDueAt } from "../core/context.js";
import { notifyByPermission } from "../core/notify.js";
import { computeAccessState, daysOverdue, DAY } from "../core/subscription.js";
import { nextInvoiceNumber } from "../core/tenantService.js";
import { getSetting } from "../modules/billing.routes.js";
import { purgeDeletedFiles } from "../modules/files.routes.js";
import { DEFAULT_ALERTS } from "../modules/companyExtras.routes.js";
import { monthlySales } from "../modules/business.routes.js";

/** Emite faturas de renovação 3 dias antes do fim do período (se não houver cancelamento). */
export async function issueRenewals(now = new Date()) {
  const due = await db.select({ s: subscriptions, p: plans }).from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(and(eq(subscriptions.status, "active"), eq(subscriptions.cancelAtPeriodEnd, false), lte(subscriptions.currentPeriodEnd, new Date(now.getTime() + 3 * DAY))));
  let n = 0;
  for (const { s, p } of due) {
    const key = `renewal:${s.currentPeriodEnd!.toISOString()}`;
    const [exists] = await db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.tenantId, s.tenantId), dsql`${invoices.meta}->>'renewalKey' = ${key}`));
    if (exists || p.priceMonthly === null) continue;
    const amount = s.billingCycle === "yearly" ? p.priceYearly ?? p.priceMonthly * 12 : p.priceMonthly;
    await db.insert(invoices).values({
      tenantId: s.tenantId, number: nextInvoiceNumber(), kind: "subscription", status: "issued", currency: p.currency,
      lines: [{ description: `Renovação ${p.name}`, quantity: 1, unitPrice: amount, total: amount }], subtotal: amount, total: amount,
      dueAt: s.currentPeriodEnd!, periodStart: s.currentPeriodEnd, meta: { renewalKey: key },
    });
    await notifyByPermission(s.tenantId, "billing.view", { type: "billing.renewal", title: "Fatura de renovação emitida", body: `Vence em ${s.currentPeriodEnd!.toISOString().slice(0, 10)}.`, link: "/app/billing", dedupeKey: key });
    n++;
  }
  return n;
}

/** Atualiza estados persistentes (cancelamento terminado, trial expirado) e envia avisos de atraso. */
export async function reconcileSubscriptions(now = new Date()) {
  const subs = await db.select().from(subscriptions);
  for (const s of subs) {
    const due = await oldestUnpaidDueAt(s.tenantId);
    const state = computeAccessState(s, due, now);
    if (state === "canceled" && s.status === "active") {
      await db.update(subscriptions).set({ status: "canceled", updatedAt: now }).where(eq(subscriptions.id, s.id));
      await audit({ tenantId: s.tenantId, actorType: "system", action: "subscription.canceled", entityType: "subscription", entityId: s.id, summary: "Período pago terminou após cancelamento; acesso operacional suspenso, dados preservados." });
    }
    if (state === "trial_expired") {
      await notifyByPermission(s.tenantId, "billing.view", { type: "trial.expired", severity: "critical", title: "A demonstração terminou", body: "Converta para um plano pago para continuar.", link: "/app/billing", dedupeKey: "trial-expired" });
    } else if (s.status === "trial" && s.trialEndsAt && s.trialEndsAt.getTime() - now.getTime() < 3 * DAY) {
      await notifyByPermission(s.tenantId, "billing.view", { type: "trial.ending", severity: "warning", title: "A demonstração termina em breve", body: `Termina a ${s.trialEndsAt.toISOString().slice(0, 10)}.`, link: "/app/billing", dedupeKey: "trial-ending" });
    }
    const d = daysOverdue(due, now);
    if (d > 0) {
      const phase = d <= 3 ? "grace" : d <= 8 ? "read_only" : "suspended";
      const msg = { grace: "Pagamento em atraso: acesso normal até ao 3.º dia.", read_only: "Pagamento em atraso: modo somente leitura (dias 4–8).", suspended: "Subscrição suspensa por falta de pagamento. Os dados estão preservados." }[phase];
      await notifyByPermission(s.tenantId, "billing.view", { type: `billing.${phase}`, severity: phase === "grace" ? "warning" : "critical", title: msg, link: "/app/billing", dedupeKey: `overdue:${phase}:${due!.toISOString()}` }, { email: true });
    }
  }
}

/** Alertas inteligentes (configuráveis por empresa): stock baixo, despesas anormais, quebra de vendas. Sem excesso (dedupe diário). */
export async function runAlerts(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const list = await db.select({ t: tenants, p: aiPolicies }).from(tenants).innerJoin(aiPolicies, eq(aiPolicies.tenantId, tenants.id));
  let sent = 0;
  for (const { t, p } of list) {
    if (!p.enabled || !p.alertsEnabled) continue;
    const cfg = { ...DEFAULT_ALERTS, ...(t.settings.alerts ?? {}) };
    const email = { email: cfg.emailCritical };
    if (cfg.lowStock) {
      const low = await db.select({ name: products.name, stockQty: products.stockQty }).from(products)
        .where(and(eq(products.tenantId, t.id), isNull(products.deletedAt), lte(products.stockQty, products.reorderLevel)));
      if (low.length) {
        const outOfStock = low.some((l) => l.stockQty <= 0);
        sent += await notifyByPermission(t.id, "inventory.view", { type: "ai.alert.low_stock", severity: outOfStock ? "critical" : "warning", title: `${low.length} produto(s) com stock baixo${outOfStock ? " (há ruturas)" : ""}`, body: low.slice(0, 5).map((l) => `${l.name} (${l.stockQty})`).join(", "), link: "/app/products?lowStock=1", dedupeKey: `low-stock:${day}` }, outOfStock ? email : {});
      }
    }
    if (cfg.abnormalExpense) {
      const [avg] = await db.select({ avg: dsql<number>`avg(${financeTransactions.amount})` }).from(financeTransactions)
        .where(and(eq(financeTransactions.tenantId, t.id), eq(financeTransactions.kind, "expense"), isNull(financeTransactions.deletedAt), dsql`${financeTransactions.occurredOn} > now() - interval '90 days'`));
      if (avg?.avg) {
        const limit = Number(avg.avg) * cfg.abnormalExpenseMultiplier;
        const big = await db.select().from(financeTransactions).where(and(eq(financeTransactions.tenantId, t.id), eq(financeTransactions.kind, "expense"), isNull(financeTransactions.deletedAt), dsql`${financeTransactions.createdAt} > now() - interval '1 day'`, dsql`${financeTransactions.amount} > ${limit}`));
        for (const b of big)
          sent += await notifyByPermission(t.id, "finance.view", { type: "ai.alert.expense", severity: "critical", title: "Despesa invulgarmente elevada", body: `${b.category}: ${b.amount} (mais de ${cfg.abnormalExpenseMultiplier}× a média recente de ${Math.round(Number(avg.avg))}).`, link: "/app/finance", dedupeKey: `expense:${b.id}` }, email);
      }
    }
    if (cfg.salesDrop && now.getUTCDate() >= 10) {
      // Projeção do mês corrente vs média dos 3 meses anteriores
      const hist = await monthlySales(t.id, 4);
      const prev = hist.slice(0, 3).map((h) => h.total).filter((v) => v > 0);
      if (prev.length === 3) {
        const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
        const projected = (hist[3].total / now.getUTCDate()) * daysInMonth;
        const base = prev.reduce((a, b) => a + b, 0) / 3;
        const drop = Math.round(((base - projected) / base) * 100);
        if (drop >= cfg.salesDropPct)
          sent += await notifyByPermission(t.id, "sales.view", { type: "ai.alert.sales_drop", severity: "warning", title: `Vendas a cair cerca de ${drop}% este mês`, body: `Projeção ${Math.round(projected)} vs média de ${Math.round(base)} nos 3 meses anteriores. Estimativa, não certeza.`, link: "/app/sales", dedupeKey: `sales-drop:${hist[3].month}` });
      }
    }
  }
  return sent;
}

/** Repõe a franquia mensal de créditos de IA (sem compras automáticas). */
export async function resetAiAllowances(now = new Date()) {
  const wallets = await db.select().from(aiWallets).where(lt(aiWallets.periodStart, new Date(now.getTime() - 30 * DAY)));
  for (const w of wallets) {
    await db.update(aiWallets).set({ balance: Math.max(w.balance, w.monthlyAllowance), periodStart: now }).where(eq(aiWallets.tenantId, w.tenantId));
    await db.insert(aiCreditTransactions).values({ tenantId: w.tenantId, amount: Math.max(0, w.monthlyAllowance - w.balance), operation: "monthly_allowance", reason: "Renovação mensal da franquia" });
  }
}

/** Purga definitiva da lixeira após o prazo, exceto registos sob retenção legal (finanças) ou legal hold. */
export async function purgeTrash(now = new Date()) {
  const list = await db.select().from(tenants);
  let purged = 0;
  for (const t of list) {
    if (t.settings.legalHold) continue;
    const cutoff = new Date(now.getTime() - (t.settings.trashRetentionDays ?? 30) * DAY);
    for (const table of [customers, products, employees] as const) {
      const r = await db.delete(table as any).where(and(eq((table as any).tenantId, t.id), isNotNull((table as any).deletedAt), lt((table as any).deletedAt, cutoff))).returning({ id: (table as any).id }).catch(() => []);
      purged += r.length;
    }
    purged += await purgeDeletedFiles(t.id, cutoff);
    // finance_transactions: NUNCA purgados aqui — obrigação legal de conservação (prazo a validar).
  }
  if (purged) await audit({ tenantId: null, actorType: "system", action: "retention.trash_purged", summary: `${purged} registo(s) eliminados definitivamente após o prazo da lixeira.` });
  return purged;
}

/** Retenção pós-cancelamento: sinaliza empresas cujo prazo terminou (eliminação exige aprovação — §6.4). */
export async function retentionReview(now = new Date()) {
  const r = await getSetting("retention", { postCancelDays: 90 });
  const ended = await db.select().from(subscriptions).where(and(inArray(subscriptions.status, ["canceled", "expired"]), lt(subscriptions.updatedAt, new Date(now.getTime() - r.postCancelDays * DAY))));
  return ended.map((s) => s.tenantId);
}

export async function runAllJobs(now = new Date()) {
  return {
    renewals: await issueRenewals(now),
    reconcile: await reconcileSubscriptions(now),
    alerts: await runAlerts(now),
    allowances: await resetAiAllowances(now),
    purged: await purgeTrash(now),
    retentionDue: await retentionReview(now),
  };
}
