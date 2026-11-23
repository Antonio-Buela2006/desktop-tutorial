/**
 * Módulos de negócio implementados (nomes provisórios — ver docs/product/pending-decisions.md):
 * CRM, Stock, Vendas e Finanças. Cada endpoint valida tenant, permissão,
 * módulo contratado e estado da subscrição através de `authorize`.
 */
import type { FastifyInstance } from "fastify";
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql as dsql, sum } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx } from "../db/client.js";
import { customers, employees, financeTransactions, products, salesOrders, stockMovements, type SaleLine } from "../db/schema.js";
import { audit } from "../core/audit.js";
import { auditBase, authorize, can, requireCtx, type Ctx } from "../core/context.js";
import { AppError, badRequest, forbidden, notFound } from "../core/errors.js";
import { pageQuery, parse, uuidParam } from "../core/http.js";
import { notifyByPermission } from "../core/notify.js";

/** Despesas a partir deste valor exigem aprovação por outra pessoa (segregação de funções). */
export const EXPENSE_APPROVAL_THRESHOLD = 500_000;

/* ---------------- Serviços reutilizados pela API e pelas ferramentas de IA ---------------- */

export const customerBody = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().email().max(160).optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(40).optional(),
  taxId: z.string().trim().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

export async function createCustomer(ctx: Ctx, input: z.infer<typeof customerBody>, actor: "user" | "ai" = "user", tx: DbOrTx = db) {
  const [c] = await tx.insert(customers).values({ ...input, tenantId: ctx.tenant.id }).returning();
  await audit({ ...auditBase(ctx), actorType: actor, action: "customer.created", entityType: "customer", entityId: c.id, summary: `Cliente ${c.name} criado.` }, tx);
  return c;
}

export async function adjustStock(ctx: Ctx, productId: string, delta: number, reason: string, actor: "user" | "ai" = "user") {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(and(eq(products.id, productId), eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt))).for("update");
    if (!p) throw notFound();
    if (p.stockQty + delta < 0) throw badRequest("O stock não pode ficar negativo.");
    const [u] = await tx.update(products).set({ stockQty: p.stockQty + delta }).where(eq(products.id, p.id)).returning();
    await tx.insert(stockMovements).values({ tenantId: ctx.tenant.id, productId: p.id, delta, reason, refType: "adjustment", createdBy: ctx.membership.id });
    await audit({ ...auditBase(ctx), actorType: actor, action: "inventory.adjusted", entityType: "product", entityId: p.id, summary: `Ajuste de stock ${delta > 0 ? "+" : ""}${delta} em ${p.name}: ${reason}`, metadata: { before: p.stockQty, after: u.stockQty } }, tx);
    return u;
  });
}

export const expenseBody = z.object({
  kind: z.enum(["income", "expense"]),
  category: z.string().trim().min(2).max(80),
  description: z.string().max(500).default(""),
  amount: z.number().positive().max(1e12),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createFinanceTx(ctx: Ctx, input: z.infer<typeof expenseBody>, actor: "user" | "ai" = "user", approvedBy?: string) {
  const needsApproval = input.kind === "expense" && input.amount >= EXPENSE_APPROVAL_THRESHOLD && !approvedBy;
  const [t] = await db
    .insert(financeTransactions)
    .values({ ...input, tenantId: ctx.tenant.id, status: needsApproval ? "pending_approval" : "approved", createdBy: ctx.membership.id, approvedBy: approvedBy ?? null })
    .returning();
  await audit({ ...auditBase(ctx), actorType: actor, action: "finance.created", entityType: "finance_transaction", entityId: t.id, summary: `${input.kind === "income" ? "Receita" : "Despesa"} ${input.category}: ${input.amount}${needsApproval ? " (aguarda aprovação)" : ""}.` });
  if (needsApproval)
    await notifyByPermission(ctx.tenant.id, "finance.approve", { type: "finance.approval", severity: "warning", title: "Despesa aguarda aprovação", body: `${input.category}: ${input.amount}`, link: "/app/finance" });
  return t;
}

export async function dashboardKpis(ctx: Ctx) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const out: Record<string, unknown> = {};
  if (can(ctx, "sales.view")) {
    const [cur] = await db.select({ total: sum(salesOrders.total), n: count() }).from(salesOrders)
      .where(and(eq(salesOrders.tenantId, ctx.tenant.id), eq(salesOrders.status, "confirmed"), isNull(salesOrders.deletedAt), gte(salesOrders.soldAt, monthStart)));
    const [prev] = await db.select({ total: sum(salesOrders.total) }).from(salesOrders)
      .where(and(eq(salesOrders.tenantId, ctx.tenant.id), eq(salesOrders.status, "confirmed"), isNull(salesOrders.deletedAt), gte(salesOrders.soldAt, prevStart), lte(salesOrders.soldAt, monthStart)));
    out.sales = { month: Number(cur.total ?? 0), orders: cur.n, previousMonth: Number(prev.total ?? 0) };
    out.salesByMonth = await monthlySales(ctx.tenant.id, 6);
  }
  if (can(ctx, "inventory.view")) {
    const low = await db.select({ id: products.id, name: products.name, sku: products.sku, stockQty: products.stockQty, reorderLevel: products.reorderLevel }).from(products)
      .where(and(eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt), lte(products.stockQty, products.reorderLevel))).orderBy(asc(products.stockQty)).limit(10);
    const [{ n }] = await db.select({ n: count() }).from(products).where(and(eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt)));
    out.inventory = { products: n, lowStock: low };
  }
  if (can(ctx, "finance.view")) {
    const monthStr = monthStart.toISOString().slice(0, 10);
    const rows = await db.select({ kind: financeTransactions.kind, total: sum(financeTransactions.amount) }).from(financeTransactions)
      .where(and(eq(financeTransactions.tenantId, ctx.tenant.id), isNull(financeTransactions.deletedAt), eq(financeTransactions.status, "approved"), gte(financeTransactions.occurredOn, monthStr)))
      .groupBy(financeTransactions.kind);
    const income = Number(rows.find((r) => r.kind === "income")?.total ?? 0);
    const expense = Number(rows.find((r) => r.kind === "expense")?.total ?? 0);
    const [{ pending }] = await db.select({ pending: count() }).from(financeTransactions).where(and(eq(financeTransactions.tenantId, ctx.tenant.id), eq(financeTransactions.status, "pending_approval"), isNull(financeTransactions.deletedAt)));
    out.finance = { income, expense, result: income - expense, pendingApprovals: pending };
  }
  if (can(ctx, "crm.view")) {
    const [{ n }] = await db.select({ n: count() }).from(customers).where(and(eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt)));
    out.customers = { total: n };
  }
  if (can(ctx, "employees.view")) {
    const [{ n }] = await db.select({ n: count() }).from(employees).where(and(eq(employees.tenantId, ctx.tenant.id), isNull(employees.deletedAt), eq(employees.status, "active")));
    out.employees = { active: n };
  }
  return out;
}

export async function monthlySales(tenantId: string, months: number) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const rows = await db
    .select({ month: dsql<string>`to_char(date_trunc('month', ${salesOrders.soldAt}), 'YYYY-MM')`, total: sum(salesOrders.total) })
    .from(salesOrders)
    .where(and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.status, "confirmed"), isNull(salesOrders.deletedAt), gte(salesOrders.soldAt, from)))
    .groupBy(dsql`1`)
    .orderBy(dsql`1`);
  const out: { month: string; total: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    out.push({ month: key, total: Number(rows.find((r) => r.month === key)?.total ?? 0) });
  }
  return out;
}

/* ---------------- Rotas ---------------- */

export async function businessRoutes(app: FastifyInstance) {
  app.get("/api/dashboard", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "dashboard.view");
    return dashboardKpis(ctx);
  });

  /* CRM */
  app.get("/api/crm/customers", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "crm.view");
    const q = parse(pageQuery, req.query);
    const where = and(eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt), q.q ? or(ilike(customers.name, `%${q.q}%`), ilike(customers.email, `%${q.q}%`), ilike(customers.taxId, `%${q.q}%`)) : undefined);
    const order = q.sort === "name" ? (q.dir === "asc" ? asc(customers.name) : desc(customers.name)) : q.dir === "asc" ? asc(customers.createdAt) : desc(customers.createdAt);
    const items = await db.select().from(customers).where(where).orderBy(order).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const [{ n }] = await db.select({ n: count() }).from(customers).where(where);
    return { items, total: n };
  });

  app.post("/api/crm/customers", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "crm.create");
    return createCustomer(ctx, parse(customerBody, req.body));
  });

  app.put("/api/crm/customers/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "crm.edit");
    const { id } = parse(uuidParam, req.params);
    const body = parse(customerBody.partial(), req.body);
    const [c] = await db.update(customers).set(body).where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt))).returning();
    if (!c) throw notFound();
    await audit({ ...auditBase(ctx), action: "customer.updated", entityType: "customer", entityId: id, summary: `Cliente ${c.name} atualizado.`, metadata: { fields: Object.keys(body) } });
    return c;
  });

  app.delete("/api/crm/customers/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "crm.delete");
    const { id } = parse(uuidParam, req.params);
    const [c] = await db.update(customers).set({ deletedAt: new Date() }).where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt))).returning();
    if (!c) throw notFound();
    await audit({ ...auditBase(ctx), action: "customer.deleted", entityType: "customer", entityId: id, summary: `Cliente ${c.name} movido para a lixeira.` });
    return { ok: true };
  });

  /* Stock */
  const productBody = z.object({
    sku: z.string().trim().min(1).max(40),
    name: z.string().trim().min(2).max(160),
    unitPrice: z.number().min(0).max(1e12),
    unitCost: z.number().min(0).max(1e12).default(0),
    reorderLevel: z.number().int().min(0).max(1e9).default(0),
  });

  app.get("/api/inventory/products", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.view");
    const q = parse(pageQuery.extend({ lowStock: z.coerce.boolean().optional() }), req.query);
    const where = and(
      eq(products.tenantId, ctx.tenant.id),
      isNull(products.deletedAt),
      q.q ? or(ilike(products.name, `%${q.q}%`), ilike(products.sku, `%${q.q}%`)) : undefined,
      q.lowStock ? lte(products.stockQty, products.reorderLevel) : undefined,
    );
    const items = await db.select().from(products).where(where).orderBy(asc(products.name)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const [{ n }] = await db.select({ n: count() }).from(products).where(where);
    return { items, total: n };
  });

  app.post("/api/inventory/products", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.create");
    const body = parse(productBody.extend({ initialStock: z.number().int().min(0).max(1e9).default(0) }), req.body);
    const { initialStock, ...data } = body;
    try {
      return await db.transaction(async (tx) => {
        const [p] = await tx.insert(products).values({ ...data, stockQty: initialStock, tenantId: ctx.tenant.id }).returning();
        if (initialStock) await tx.insert(stockMovements).values({ tenantId: ctx.tenant.id, productId: p.id, delta: initialStock, reason: "Stock inicial", createdBy: ctx.membership.id });
        await audit({ ...auditBase(ctx), action: "product.created", entityType: "product", entityId: p.id, summary: `Produto ${p.sku} criado.` }, tx);
        return p;
      });
    } catch (e: any) {
      if (e?.code === "23505" || e?.cause?.code === "23505") throw new AppError(409, "DUPLICATE_SKU", "Já existe um produto com este SKU.");
      throw e;
    }
  });

  app.put("/api/inventory/products/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.edit");
    const { id } = parse(uuidParam, req.params);
    const body = parse(productBody.partial(), req.body);
    const [p] = await db.update(products).set(body).where(and(eq(products.id, id), eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt))).returning();
    if (!p) throw notFound();
    await audit({ ...auditBase(ctx), action: "product.updated", entityType: "product", entityId: id, summary: `Produto ${p.sku} atualizado.`, metadata: body });
    return p;
  });

  app.delete("/api/inventory/products/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.delete");
    const { id } = parse(uuidParam, req.params);
    const [p] = await db.update(products).set({ deletedAt: new Date() }).where(and(eq(products.id, id), eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt))).returning();
    if (!p) throw notFound();
    await audit({ ...auditBase(ctx), action: "product.deleted", entityType: "product", entityId: id, summary: `Produto ${p.sku} movido para a lixeira.` });
    return { ok: true };
  });

  app.post("/api/inventory/products/:id/adjust", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.adjust");
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ delta: z.number().int().min(-1e6).max(1e6).refine((v) => v !== 0, "O ajuste não pode ser zero."), reason: z.string().trim().min(3).max(200) }), req.body);
    return adjustStock(ctx, id, body.delta, body.reason);
  });

  app.get("/api/inventory/movements", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.view");
    const q = parse(pageQuery.extend({ productId: z.string().uuid().optional() }), req.query);
    const where = and(eq(stockMovements.tenantId, ctx.tenant.id), q.productId ? eq(stockMovements.productId, q.productId) : undefined);
    const items = await db.select({ m: stockMovements, product: products.name }).from(stockMovements).innerJoin(products, eq(products.id, stockMovements.productId))
      .where(where).orderBy(desc(stockMovements.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const [{ n }] = await db.select({ n: count() }).from(stockMovements).where(where);
    return { items: items.map((i) => ({ ...i.m, product: i.product })), total: n };
  });

  /* Vendas */
  app.get("/api/sales/orders", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "sales.view");
    const q = parse(pageQuery, req.query);
    const where = and(eq(salesOrders.tenantId, ctx.tenant.id), isNull(salesOrders.deletedAt), q.q ? ilike(salesOrders.number, `%${q.q}%`) : undefined);
    const items = await db.select({ o: salesOrders, customer: customers.name }).from(salesOrders).leftJoin(customers, eq(customers.id, salesOrders.customerId))
      .where(where).orderBy(desc(salesOrders.soldAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const [{ n }] = await db.select({ n: count() }).from(salesOrders).where(where);
    return { items: items.map((i) => ({ ...i.o, customer: i.customer })), total: n };
  });

  /** Venda integrada numa única transação: valida stock, dá baixa, regista movimentos e auditoria. */
  app.post("/api/sales/orders", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "sales.create");
    const body = parse(
      z.object({
        customerId: z.string().uuid().optional(),
        lines: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(1e6) })).min(1).max(100),
      }),
      req.body,
    );
    return db.transaction(async (tx) => {
      if (body.customerId) {
        const [c] = await tx.select({ id: customers.id }).from(customers).where(and(eq(customers.id, body.customerId), eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt)));
        if (!c) throw badRequest("Cliente inválido.");
      }
      const lines: SaleLine[] = [];
      for (const l of body.lines) {
        const [p] = await tx.select().from(products).where(and(eq(products.id, l.productId), eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt))).for("update");
        if (!p) throw badRequest("Produto inválido.");
        if (p.stockQty < l.quantity) throw new AppError(409, "INSUFFICIENT_STOCK", `Stock insuficiente para ${p.name} (disponível: ${p.stockQty}).`);
        await tx.update(products).set({ stockQty: p.stockQty - l.quantity }).where(eq(products.id, p.id));
        lines.push({ productId: p.id, name: p.name, quantity: l.quantity, unitPrice: p.unitPrice, total: Math.round(p.unitPrice * l.quantity * 100) / 100 });
      }
      const [{ n }] = await tx.select({ n: count() }).from(salesOrders).where(eq(salesOrders.tenantId, ctx.tenant.id));
      const total = Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;
      const [o] = await tx.insert(salesOrders).values({ tenantId: ctx.tenant.id, number: `V-${String(n + 1).padStart(5, "0")}`, customerId: body.customerId ?? null, lines, total, createdBy: ctx.membership.id }).returning();
      for (const l of lines) await tx.insert(stockMovements).values({ tenantId: ctx.tenant.id, productId: l.productId, delta: -l.quantity, reason: `Venda ${o.number}`, refType: "sale", refId: o.id, createdBy: ctx.membership.id });
      await audit({ ...auditBase(ctx), action: "sale.created", entityType: "sale", entityId: o.id, summary: `Venda ${o.number} registada (${total}).` }, tx);
      return o;
    });
  });

  app.post("/api/sales/orders/:id/cancel", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "sales.cancel");
    const { id } = parse(uuidParam, req.params);
    return db.transaction(async (tx) => {
      const [o] = await tx.select().from(salesOrders).where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, ctx.tenant.id), eq(salesOrders.status, "confirmed"))).for("update");
      if (!o) throw notFound();
      for (const l of o.lines) {
        await tx.update(products).set({ stockQty: dsql`${products.stockQty} + ${l.quantity}` }).where(and(eq(products.id, l.productId), eq(products.tenantId, ctx.tenant.id)));
        await tx.insert(stockMovements).values({ tenantId: ctx.tenant.id, productId: l.productId, delta: l.quantity, reason: `Anulação ${o.number}`, refType: "sale_cancel", refId: o.id, createdBy: ctx.membership.id });
      }
      await tx.update(salesOrders).set({ status: "canceled" }).where(eq(salesOrders.id, id));
      await audit({ ...auditBase(ctx), action: "sale.canceled", entityType: "sale", entityId: id, summary: `Venda ${o.number} anulada; stock reposto.` }, tx);
      return { ok: true };
    });
  });

  /* Finanças */
  app.get("/api/finance/transactions", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "finance.view");
    const q = parse(pageQuery.extend({ kind: z.enum(["income", "expense"]).optional(), status: z.enum(["pending_approval", "approved", "rejected"]).optional() }), req.query);
    const where = and(
      eq(financeTransactions.tenantId, ctx.tenant.id),
      isNull(financeTransactions.deletedAt),
      q.kind ? eq(financeTransactions.kind, q.kind) : undefined,
      q.status ? eq(financeTransactions.status, q.status) : undefined,
      q.q ? or(ilike(financeTransactions.category, `%${q.q}%`), ilike(financeTransactions.description, `%${q.q}%`)) : undefined,
    );
    const items = await db.select().from(financeTransactions).where(where).orderBy(desc(financeTransactions.occurredOn), desc(financeTransactions.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const [{ n }] = await db.select({ n: count() }).from(financeTransactions).where(where);
    return { items, total: n, approvalThreshold: EXPENSE_APPROVAL_THRESHOLD };
  });

  app.post("/api/finance/transactions", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "finance.create");
    return createFinanceTx(ctx, parse(expenseBody, req.body));
  });

  app.post("/api/finance/transactions/:id/decision", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "finance.approve");
    const { id } = parse(uuidParam, req.params);
    const { decision } = parse(z.object({ decision: z.enum(["approve", "reject"]) }), req.body);
    const [t] = await db.select().from(financeTransactions).where(and(eq(financeTransactions.id, id), eq(financeTransactions.tenantId, ctx.tenant.id), eq(financeTransactions.status, "pending_approval"), isNull(financeTransactions.deletedAt)));
    if (!t) throw notFound();
    // Segregação de funções: quem regista não aprova.
    if (t.createdBy === ctx.membership.id) throw forbidden("Não pode aprovar uma despesa registada por si (segregação de funções).", "SEGREGATION_OF_DUTIES");
    await db.update(financeTransactions).set({ status: decision === "approve" ? "approved" : "rejected", approvedBy: ctx.membership.id }).where(eq(financeTransactions.id, id));
    await audit({ ...auditBase(ctx), action: `finance.${decision}d`, entityType: "finance_transaction", entityId: id, summary: `Despesa ${t.category} (${t.amount}) ${decision === "approve" ? "aprovada" : "rejeitada"}.` });
    return { ok: true };
  });

  app.delete("/api/finance/transactions/:id", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "finance.delete");
    const { id } = parse(uuidParam, req.params);
    const [t] = await db.update(financeTransactions).set({ deletedAt: new Date() }).where(and(eq(financeTransactions.id, id), eq(financeTransactions.tenantId, ctx.tenant.id), isNull(financeTransactions.deletedAt))).returning();
    if (!t) throw notFound();
    await audit({ ...auditBase(ctx), action: "finance.deleted", entityType: "finance_transaction", entityId: id, summary: `Movimento ${t.category} movido para a lixeira (retenção legal aplicável).` });
    return { ok: true };
  });
}
