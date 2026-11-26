/**
 * Aprendizagem contextual por empresa (spec 9.6): perfil de padrões calculado a partir do histórico
 * autorizado da própria empresa, para a IA adaptar análises e recomendações.
 *
 * Privacidade:
 * - só existe com `learningEnabled` ligado na política de IA (consentimento da empresa);
 * - é calculado no momento e não é guardado (desligar a opção apaga-o de facto);
 * - respeita o tenant (RLS + filtros), as permissões e o âmbito de unidades de quem pergunta;
 * - contém agregados (totais, médias, quotas), nunca dados pessoais de clientes ou funcionários.
 */
import { and, desc, eq, gte, isNull, lte, sql as dsql, sum } from "drizzle-orm";
import { db } from "../db/client.js";
import { customers, financeTransactions, products, salesOrders } from "../db/schema.js";
import { branchCondition, can, type Ctx } from "../core/context.js";
import { monthlySales } from "../modules/business.routes.js";

const DAY = 86_400_000;
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const round = (n: number) => Math.round(n);
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export async function companyProfile(ctx: Ctx, now = new Date()) {
  const since90 = new Date(now.getTime() - 90 * DAY);
  const profile: Record<string, unknown> = { periodDays: 90, generatedAt: now.toISOString() };
  const notes: string[] = [];

  if (can(ctx, "sales.view") && ctx.modules.has("sales")) {
    const scope = branchCondition(ctx, salesOrders.branchId);
    const orders = await db.select({ total: salesOrders.total, soldAt: salesOrders.soldAt, lines: salesOrders.lines, customerId: salesOrders.customerId }).from(salesOrders)
      .where(and(eq(salesOrders.tenantId, ctx.tenant.id), eq(salesOrders.status, "confirmed"), isNull(salesOrders.deletedAt), gte(salesOrders.soldAt, since90), scope));
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const byDay = Array(7).fill(0);
    for (const o of orders) byDay[o.soldAt.getUTCDay()] += Number(o.total);
    const prod = new Map<string, { name: string; revenue: number; qty: number }>();
    for (const o of orders)
      for (const l of o.lines) {
        const p = prod.get(l.productId) ?? { name: l.name, revenue: 0, qty: 0 };
        p.revenue += l.total;
        p.qty += l.quantity;
        prod.set(l.productId, p);
      }
    const buyers = new Map<string, number>();
    for (const o of orders) if (o.customerId) buyers.set(o.customerId, (buyers.get(o.customerId) ?? 0) + 1);
    const months = await monthlySales(ctx.tenant.id, 12, scope);
    const withSales = months.slice(0, -1).filter((mm) => mm.total > 0); // mês corrente incompleto fica de fora
    const best = [...withSales].sort((a, b) => b.total - a.total)[0];
    const worst = [...withSales].sort((a, b) => a.total - b.total)[0];
    const bestDay = byDay.indexOf(Math.max(...byDay));
    profile.sales = {
      orders: orders.length,
      revenue: round(revenue),
      averageTicket: orders.length ? round(revenue / orders.length) : 0,
      bestWeekday: orders.length ? WEEKDAYS[bestDay] : null,
      bestWeekdayShare: pct(byDay[bestDay], revenue),
      topProducts: [...prod.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 3).map((p) => ({ name: p.name, revenue: round(p.revenue), share: pct(p.revenue, revenue), quantity: p.qty })),
      repeatCustomerShare: pct([...buyers.values()].filter((n) => n >= 2).length, buyers.size),
      bestMonth: best ? { month: best.month, revenue: round(best.total) } : null,
      weakestMonth: worst && worst !== best ? { month: worst.month, revenue: round(worst.total) } : null,
      monthsWithSales: withSales.length,
    };
    if (withSales.length < 6) notes.push("Menos de 6 meses de vendas: os padrões mensais ainda são pouco fiáveis.");
  }

  if (can(ctx, "inventory.view") && ctx.modules.has("inventory")) {
    const [low] = await db.select({ n: dsql<number>`count(*)::int` }).from(products)
      .where(and(eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt), lte(products.stockQty, products.reorderLevel)));
    const [all] = await db.select({ n: dsql<number>`count(*)::int` }).from(products).where(and(eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt)));
    profile.inventory = { products: all.n, atOrBelowReorder: low.n, atOrBelowReorderShare: pct(low.n, all.n) };
  }

  if (can(ctx, "finance.view") && ctx.modules.has("finance")) {
    const cats = await db.select({ category: financeTransactions.category, total: sum(financeTransactions.amount) }).from(financeTransactions)
      .where(and(eq(financeTransactions.tenantId, ctx.tenant.id), eq(financeTransactions.kind, "expense"), eq(financeTransactions.status, "approved"), isNull(financeTransactions.deletedAt),
        gte(financeTransactions.occurredOn, since90.toISOString().slice(0, 10)), branchCondition(ctx, financeTransactions.branchId)))
      .groupBy(financeTransactions.category).orderBy(desc(sum(financeTransactions.amount)));
    const total = cats.reduce((s, c) => s + Number(c.total ?? 0), 0);
    profile.finance = {
      expenses90d: round(total),
      averageMonthlyExpense: round(total / 3),
      topExpenseCategories: cats.slice(0, 3).map((c) => ({ category: c.category, total: round(Number(c.total ?? 0)), share: pct(Number(c.total ?? 0), total) })),
    };
  }

  if (can(ctx, "crm.view") && ctx.modules.has("crm")) {
    const [c] = await db.select({ n: dsql<number>`count(*)::int` }).from(customers).where(and(eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt)));
    profile.customers = { total: c.n };
  }

  profile.notes = notes;
  profile.privacy = "Agregados calculados no momento a partir do histórico desta empresa; não são guardados nem partilhados com outras empresas.";
  return profile;
}

/** Recomendações em linguagem simples a partir do perfil (assistente local). */
export function recommendationsFrom(p: any, en: boolean): string[] {
  const out: string[] = [];
  const day = (d: string) => (en ? ({ domingo: "Sunday", segunda: "Monday", "terça": "Tuesday", quarta: "Wednesday", quinta: "Thursday", sexta: "Friday", "sábado": "Saturday" } as Record<string, string>)[d] ?? d : d);
  if (p.sales?.orders) {
    const s = p.sales;
    if (s.bestWeekday) out.push(en ? `${day(s.bestWeekday)} is your strongest day (${s.bestWeekdayShare}% of revenue in 90 days): make sure stock and staff are ready the day before.` : `${s.bestWeekday[0].toUpperCase() + s.bestWeekday.slice(1)} é o seu dia mais forte (${s.bestWeekdayShare}% da receita em 90 dias): garanta stock e pessoal na véspera.`);
    if (s.topProducts?.length) out.push(en ? `Your top products are ${s.topProducts.map((t: any) => `${t.name} (${t.share}%)`).join(", ")}; prioritise their replenishment.` : `Os produtos que mais vendem são ${s.topProducts.map((t: any) => `${t.name} (${t.share}%)`).join(", ")}; dê prioridade à sua reposição.`);
    if (s.repeatCustomerShare < 30) out.push(en ? `Only ${s.repeatCustomerShare}% of identified customers bought more than once: consider a loyalty action.` : `Só ${s.repeatCustomerShare}% dos clientes identificados compraram mais de uma vez: considere uma ação de fidelização.`);
    if (s.bestMonth && s.weakestMonth) out.push(en ? `Best month: ${s.bestMonth.month}; weakest: ${s.weakestMonth.month}. Plan purchases and promotions around this pattern.` : `Melhor mês: ${s.bestMonth.month}; mais fraco: ${s.weakestMonth.month}. Planeie compras e promoções em função deste padrão.`);
  }
  if (p.inventory?.atOrBelowReorderShare >= 25) out.push(en ? `${p.inventory.atOrBelowReorderShare}% of products are at or below reorder level: review reorder levels or purchase frequency.` : `${p.inventory.atOrBelowReorderShare}% dos produtos estão no nível de reposição ou abaixo: reveja os níveis ou a frequência das compras.`);
  if (p.finance?.topExpenseCategories?.length) {
    const t = p.finance.topExpenseCategories[0];
    out.push(en ? `"${t.category}" is ${t.share}% of expenses in 90 days; it is the first place to look for savings.` : `"${t.category}" representa ${t.share}% das despesas em 90 dias; é o primeiro sítio onde procurar poupanças.`);
  }
  return out;
}
