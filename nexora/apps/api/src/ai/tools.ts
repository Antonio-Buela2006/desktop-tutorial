/**
 * Ferramentas da IA — lista permitida (allowlist) executada no SERVIDOR.
 * Cada ferramenta declara a permissão RBAC e o módulo de que depende; a IA herda
 * sempre as permissões do utilizador que faz o pedido. O modelo nunca tem acesso
 * direto à base de dados.
 */
import { and, asc, eq, gte, ilike, isNull, lte, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { customers, financeTransactions, products } from "../db/schema.js";
import { authorize, type Ctx } from "../core/context.js";
import { adjustStock, createCustomer, createFinanceTx, customerBody, dashboardKpis, monthlySales } from "../modules/business.routes.js";
import { linearForecast, simulatePriceChange } from "./predict.js";

export type Sensitivity = "read" | "simple_write" | "sensitive";

export type AITool = {
  name: string;
  description: string;
  module: string | null; // módulo de dados (para política de acesso da IA)
  permission: string;
  sensitivity: Sensitivity;
  costKey: "tool_read" | "tool_write" | "forecast" | "simulation";
  schema: z.ZodTypeAny;
  jsonSchema: Record<string, unknown>;
  /** Pré-visualização legível do que será executado (ações de escrita). */
  preview?: (ctx: Ctx, input: any) => Promise<Record<string, unknown>>;
  run: (ctx: Ctx, input: any, meta?: { approvedBy?: string }) => Promise<unknown>;
};

const empty = { type: "object", properties: {}, additionalProperties: false };

function nextMonths(k: number) {
  const now = new Date();
  return Array.from({ length: k }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i + 1, 1)).toISOString().slice(0, 7));
}

export const TOOLS: AITool[] = [
  {
    name: "business_overview",
    description: "Resumo dos indicadores principais da empresa (vendas do mês, stock baixo, finanças, clientes) — apenas dos módulos a que o utilizador tem acesso.",
    module: null,
    permission: "dashboard.view",
    sensitivity: "read",
    costKey: "tool_read",
    schema: z.object({}),
    jsonSchema: empty,
    run: (ctx) => dashboardKpis(ctx),
  },
  {
    name: "list_low_stock",
    description: "Lista produtos com stock igual ou abaixo do nível de reposição.",
    module: "inventory",
    permission: "inventory.view",
    sensitivity: "read",
    costKey: "tool_read",
    schema: z.object({}),
    jsonSchema: empty,
    run: async (ctx) =>
      db.select({ sku: products.sku, name: products.name, stockQty: products.stockQty, reorderLevel: products.reorderLevel }).from(products)
        .where(and(eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt), lte(products.stockQty, products.reorderLevel))).orderBy(asc(products.stockQty)).limit(50),
  },
  {
    name: "search_customers",
    description: "Pesquisa clientes por nome.",
    module: "crm",
    permission: "crm.view",
    sensitivity: "read",
    costKey: "tool_read",
    schema: z.object({ query: z.string().min(1).max(80) }),
    jsonSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
    run: async (ctx, i) =>
      db.select({ name: customers.name, email: customers.email, phone: customers.phone }).from(customers)
        .where(and(eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt), ilike(customers.name, `%${i.query}%`))).limit(20),
  },
  {
    name: "forecast_sales",
    description: "Previsão de vendas para os próximos meses com intervalo de confiança, pressupostos e limitações.",
    module: "sales",
    permission: "sales.view",
    sensitivity: "read",
    costKey: "forecast",
    schema: z.object({ months: z.number().int().min(1).max(6).default(3) }),
    jsonSchema: { type: "object", properties: { months: { type: "integer", minimum: 1, maximum: 6 } }, additionalProperties: false },
    run: async (ctx, i) => {
      const hist = (await monthlySales(ctx.tenant.id, 12)).filter((h, idx, arr) => h.total > 0 || idx >= arr.findIndex((x) => x.total > 0));
      // exclui o mês corrente (incompleto) do treino
      const train = hist.slice(0, -1).map((h) => ({ period: h.month, value: h.total }));
      const months = i.months ?? 3;
      // Períodos previstos: mês corrente (incompleto) + meses seguintes
      return linearForecast(train, months, [hist[hist.length - 1].month, ...nextMonths(months - 1)]);
    },
  },
  {
    name: "simulate_price_change",
    description: "Simula o impacto de alterar preços e/ou custos (percentagens) na receita e margem mensais.",
    module: "sales",
    permission: "reports.view",
    sensitivity: "read",
    costKey: "simulation",
    schema: z.object({ pricePct: z.number().min(-50).max(100), costPct: z.number().min(-50).max(100).default(0) }),
    jsonSchema: { type: "object", properties: { pricePct: { type: "number" }, costPct: { type: "number" } }, required: ["pricePct"], additionalProperties: false },
    run: async (ctx, i) => {
      const hist = await monthlySales(ctx.tenant.id, 2);
      const revenue = hist[0].total || hist[1].total;
      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
      const [c] = await db.select({ total: sum(financeTransactions.amount) }).from(financeTransactions)
        .where(and(eq(financeTransactions.tenantId, ctx.tenant.id), eq(financeTransactions.kind, "expense"), isNull(financeTransactions.deletedAt), gte(financeTransactions.occurredOn, monthStart)));
      return simulatePriceChange({ revenue, cost: Number(c.total ?? 0) / 2 || revenue * 0.7 }, i.pricePct, i.costPct ?? 0);
    },
  },
  {
    name: "create_customer",
    description: "Cria um cliente (operação simples e reversível).",
    module: "crm",
    permission: "crm.create",
    sensitivity: "simple_write",
    costKey: "tool_write",
    schema: customerBody,
    jsonSchema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" } }, required: ["name"], additionalProperties: false },
    preview: async (_ctx, i) => ({ acao: "Criar cliente", dados: i, impacto: "Novo registo em Clientes; reversível (pode ser eliminado)." }),
    run: (ctx, i) => createCustomer(ctx, i, "ai"),
  },
  {
    name: "adjust_stock",
    description: "Ajusta o stock de um produto (por SKU). Exige aprovação humana.",
    module: "inventory",
    permission: "inventory.adjust",
    sensitivity: "sensitive",
    costKey: "tool_write",
    schema: z.object({ sku: z.string().min(1).max(40), delta: z.number().int().min(-100000).max(100000), reason: z.string().min(3).max(200) }),
    jsonSchema: { type: "object", properties: { sku: { type: "string" }, delta: { type: "integer" }, reason: { type: "string" } }, required: ["sku", "delta", "reason"], additionalProperties: false },
    preview: async (ctx, i) => {
      const [p] = await db.select().from(products).where(and(eq(products.tenantId, ctx.tenant.id), eq(products.sku, i.sku), isNull(products.deletedAt)));
      if (!p) throw new Error("Produto não encontrado.");
      return { acao: "Ajustar stock", produto: `${p.sku} · ${p.name}`, antes: p.stockQty, depois: p.stockQty + i.delta, motivo: i.reason };
    },
    run: async (ctx, i) => {
      const [p] = await db.select().from(products).where(and(eq(products.tenantId, ctx.tenant.id), eq(products.sku, i.sku), isNull(products.deletedAt)));
      if (!p) throw new Error("Produto não encontrado.");
      return adjustStock(ctx, p.id, i.delta, `[IA] ${i.reason}`, "ai");
    },
  },
  {
    name: "record_expense",
    description: "Regista uma despesa. Movimento financeiro: exige aprovação humana.",
    module: "finance",
    permission: "finance.create",
    sensitivity: "sensitive",
    costKey: "tool_write",
    schema: z.object({ category: z.string().min(2).max(80), amount: z.number().positive(), description: z.string().max(300).default(""), occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    jsonSchema: { type: "object", properties: { category: { type: "string" }, amount: { type: "number" }, description: { type: "string" }, occurredOn: { type: "string", description: "AAAA-MM-DD" } }, required: ["category", "amount", "occurredOn"], additionalProperties: false },
    preview: async (_ctx, i) => ({ acao: "Registar despesa", categoria: i.category, valor: i.amount, data: i.occurredOn, descricao: i.description, impacto: "Afeta o resultado financeiro do período." }),
    run: (ctx, i, meta) => createFinanceTx(ctx, { kind: "expense", ...i }, "ai", meta?.approvedBy),
  },
];

export const toolByName = (name: string) => TOOLS.find((t) => t.name === name);

/** Ferramentas que este utilizador pode usar dada a política de IA da empresa. */
export function toolsFor(ctx: Ctx, policy: { accessLevel: string; allowedModules: string[]; disabledModules: string[] }) {
  return TOOLS.filter((t) => {
    if (t.module) {
      if (policy.accessLevel === "restricted") return false;
      if (policy.accessLevel === "custom" && !policy.allowedModules.includes(t.module)) return false;
      if (policy.disabledModules.includes(t.module)) return false;
    }
    try {
      authorize(ctx, t.permission, t.sensitivity === "read" ? "read" : "write");
      return true;
    } catch {
      return false;
    }
  });
}
