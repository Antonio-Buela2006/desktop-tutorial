/**
 * Módulos de negócio implementados (nomes provisórios — ver docs/product/pending-decisions.md):
 * CRM, Stock, Vendas e Finanças. Cada endpoint valida tenant, permissão,
 * módulo contratado e estado da subscrição através de `authorize`.
 */
import type { FastifyInstance } from "fastify";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql as dsql, sum, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, type DbOrTx } from "../db/client.js";
import { customers, employees, financeTransactions, products, salesOrders, stockLevels, stockMovements, stockTransfers, type SaleLine } from "../db/schema.js";
import { applyMove, centralQty, lockProduct, transfer } from "../core/inventory.js";
import { randomUUID } from "node:crypto";
import { inTransitByProduct } from "./transfers.routes.js";
import { audit } from "../core/audit.js";
import { auditBase, authorize, branchCondition, can, requireCtx, resolveBranchForWrite, type Ctx } from "../core/context.js";
import { AppError, badRequest, forbidden, notFound } from "../core/errors.js";
import { pageQuery, parse, uuidParam, orderFor } from "../core/http.js";
import { notifyByPermission } from "../core/notify.js";
import { m, render, asLocale } from "../core/messages.js";

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

/** Ajuste de stock numa localização (unidade ou armazém central). Utilizadores restritos só ajustam as suas unidades. */
export async function adjustStock(ctx: Ctx, productId: string, delta: number, reason: string, actor: "user" | "ai" = "user", branchIdInput?: string | null) {
  const branchId = await resolveBranchForWrite(ctx, branchIdInput);
  return db.transaction(async (tx) => {
    const p = await lockProduct(tx, ctx.tenant.id, productId);
    const before = p.stockQty;
    await applyMove(tx, { tenantId: ctx.tenant.id, product: p, branchId, delta, reason, refType: "adjustment", createdBy: ctx.membership.id });
    await audit({ ...auditBase(ctx), actorType: actor, action: "inventory.adjusted", entityType: "product", entityId: p.id, summary: `Ajuste de stock ${delta > 0 ? "+" : ""}${delta} em ${p.name} (${branchId ? "unidade" : "armazém central"}): ${reason}`, metadata: { before, after: p.stockQty, branchId } }, tx);
    return p;
  });
}

export const expenseBody = z.object({
  kind: z.enum(["income", "expense"]),
  branchId: z.string().uuid().nullable().optional(),
  category: z.string().trim().min(2).max(80),
  description: z.string().max(500).default(""),
  amount: z.number().positive().max(1e12),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createFinanceTx(ctx: Ctx, input: z.infer<typeof expenseBody>, actor: "user" | "ai" = "user", approvedBy?: string) {
  const needsApproval = input.kind === "expense" && input.amount >= EXPENSE_APPROVAL_THRESHOLD && !approvedBy;
  const branchId = await resolveBranchForWrite(ctx, input.branchId);
  const [t] = await db
    .insert(financeTransactions)
    .values({ ...input, branchId, tenantId: ctx.tenant.id, status: needsApproval ? "pending_approval" : "approved", createdBy: ctx.membership.id, approvedBy: approvedBy ?? null })
    .returning();
  await audit({ ...auditBase(ctx), actorType: actor, action: "finance.created", entityType: "finance_transaction", entityId: t.id, summary: `${input.kind === "income" ? "Receita" : "Despesa"} ${input.category}: ${input.amount}${needsApproval ? " (aguarda aprovação)" : ""}.` });
  if (needsApproval)
    await notifyByPermission(ctx.tenant.id, "finance.approve", { type: "finance.approval", severity: "warning", title: m("finance.approval.title"), body: `${input.category}: ${input.amount}`, link: "/app/finance" });
  return t;
}

export async function dashboardKpis(ctx: Ctx, branchId?: string) {
  const now = new Date();
  const salesBranch = branchCondition(ctx, salesOrders.branchId, branchId);
  const finBranch = branchCondition(ctx, financeTransactions.branchId, branchId);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const out: Record<string, unknown> = {};
  if (can(ctx, "sales.view")) {
    const [cur] = await db.select({ total: sum(salesOrders.total), n: count() }).from(salesOrders)
      .where(and(eq(salesOrders.tenantId, ctx.tenant.id), eq(salesOrders.status, "confirmed"), isNull(salesOrders.deletedAt), gte(salesOrders.soldAt, monthStart), salesBranch));
    const [prev] = await db.select({ total: sum(salesOrders.total) }).from(salesOrders)
      .where(and(eq(salesOrders.tenantId, ctx.tenant.id), eq(salesOrders.status, "confirmed"), isNull(salesOrders.deletedAt), gte(salesOrders.soldAt, prevStart), lte(salesOrders.soldAt, monthStart), salesBranch));
    out.sales = { month: Number(cur.total ?? 0), orders: cur.n, previousMonth: Number(prev.total ?? 0) };
    out.salesByMonth = await monthlySales(ctx.tenant.id, 6, salesBranch);
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
      .where(and(eq(financeTransactions.tenantId, ctx.tenant.id), isNull(financeTransactions.deletedAt), eq(financeTransactions.status, "approved"), gte(financeTransactions.occurredOn, monthStr), finBranch))
      .groupBy(financeTransactions.kind);
    const income = Number(rows.find((r) => r.kind === "income")?.total ?? 0);
    const expense = Number(rows.find((r) => r.kind === "expense")?.total ?? 0);
    const [{ pending }] = await db.select({ pending: count() }).from(financeTransactions).where(and(eq(financeTransactions.tenantId, ctx.tenant.id), eq(financeTransactions.status, "pending_approval"), isNull(financeTransactions.deletedAt), finBranch));
    out.finance = { income, expense, result: income - expense, pendingApprovals: pending };
  }
  if (can(ctx, "crm.view")) {
    const [{ n }] = await db.select({ n: count() }).from(customers).where(and(eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt)));
    out.customers = { total: n };
  }
  if (can(ctx, "employees.view")) {
    const [{ n }] = await db.select({ n: count() }).from(employees).where(and(eq(employees.tenantId, ctx.tenant.id), isNull(employees.deletedAt), eq(employees.status, "active"), branchCondition(ctx, employees.branchId, branchId)));
    out.employees = { active: n };
  }
  return out;
}

export async function monthlySales(tenantId: string, months: number, extra?: SQL) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const rows = await db
    .select({ month: dsql<string>`to_char(date_trunc('month', ${salesOrders.soldAt}), 'YYYY-MM')`, total: sum(salesOrders.total) })
    .from(salesOrders)
    .where(and(eq(salesOrders.tenantId, tenantId), eq(salesOrders.status, "confirmed"), isNull(salesOrders.deletedAt), gte(salesOrders.soldAt, from), extra))
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
    const { branchId } = parse(z.object({ branchId: z.string().uuid().optional() }), req.query);
    return dashboardKpis(ctx, branchId);
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

  /* Eliminação em lote com pré-visualização (spec 11): dryRun mostra o efeito em cada registo sem alterar nada. */
  const bulkBody = z.object({ ids: z.array(z.string().uuid()).min(1).max(100), dryRun: z.boolean().default(true) });

  app.post("/api/crm/customers/bulk-delete", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "crm.delete");
    const { ids, dryRun } = parse(bulkBody, req.body);
    const unique = [...new Set(ids)];
    return db.transaction(async (tx) => {
      const rows = await tx.select({ id: customers.id, name: customers.name }).from(customers)
        .where(and(eq(customers.tenantId, ctx.tenant.id), inArray(customers.id, unique), isNull(customers.deletedAt))).for("update");
      const since = new Date(Date.now() - 90 * 86_400_000);
      const recent = new Set((await tx.select({ id: salesOrders.customerId }).from(salesOrders)
        .where(and(eq(salesOrders.tenantId, ctx.tenant.id), inArray(salesOrders.customerId, unique), gte(salesOrders.soldAt, since), eq(salesOrders.status, "confirmed")))).map((r) => r.id));
      const items = unique.map((id) => {
        const r = rows.find((x) => x.id === id);
        if (!r) return { id, label: null, status: "not_found" as const, warnings: [] as { code: string }[] };
        return { id, label: r.name, status: "ok" as const, warnings: recent.has(id) ? [{ code: "RECENT_SALES" }] : [] };
      });
      const ok = items.filter((i) => i.status === "ok").map((i) => i.id);
      let applied = 0;
      if (!dryRun && ok.length) {
        const done = await tx.update(customers).set({ deletedAt: new Date() }).where(and(eq(customers.tenantId, ctx.tenant.id), inArray(customers.id, ok), isNull(customers.deletedAt))).returning({ id: customers.id, name: customers.name });
        for (const c of done) await audit({ ...auditBase(ctx), action: "customer.deleted", entityType: "customer", entityId: c.id, summary: `Cliente ${c.name} movido para a lixeira (eliminação em lote).` }, tx);
        applied = done.length;
      }
      return { dryRun, items, applied };
    });
  });

  app.post("/api/inventory/products/bulk-delete", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.delete");
    const { ids, dryRun } = parse(bulkBody, req.body);
    const unique = [...new Set(ids)];
    return db.transaction(async (tx) => {
      const rows = await tx.select({ id: products.id, sku: products.sku, name: products.name, stockQty: products.stockQty }).from(products)
        .where(and(eq(products.tenantId, ctx.tenant.id), inArray(products.id, unique), isNull(products.deletedAt))).for("update");
      const open = await openTransfersByProduct(tx, ctx.tenant.id, unique);
      const items = unique.map((id) => {
        const r = rows.find((x) => x.id === id);
        if (!r) return { id, label: null, status: "not_found" as const, warnings: [] as { code: string; qty?: number }[] };
        const label = `${r.sku} · ${r.name}`;
        if (open.has(id)) return { id, label, status: "blocked" as const, reason: { code: "IN_OPEN_TRANSFER", orders: open.get(id)! }, warnings: [] };
        return { id, label, status: "ok" as const, warnings: r.stockQty !== 0 ? [{ code: "HAS_STOCK", qty: r.stockQty }] : [] };
      });
      const ok = items.filter((i) => i.status === "ok").map((i) => i.id);
      let applied = 0;
      if (!dryRun && ok.length) {
        const done = await tx.update(products).set({ deletedAt: new Date() }).where(and(eq(products.tenantId, ctx.tenant.id), inArray(products.id, ok), isNull(products.deletedAt))).returning({ id: products.id, sku: products.sku });
        for (const p of done) await audit({ ...auditBase(ctx), action: "product.deleted", entityType: "product", entityId: p.id, summary: `Produto ${p.sku} movido para a lixeira (eliminação em lote).` }, tx);
        applied = done.length;
      }
      return { dryRun, items, applied };
    });
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
    const order = orderFor(q, { sku: products.sku, name: products.name, unitPrice: products.unitPrice, stockQty: products.stockQty, reorderLevel: products.reorderLevel }, [asc(products.name)], products.id);
    const items = await db.select().from(products).where(where).orderBy(...order).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const [{ n }] = await db.select({ n: count() }).from(products).where(where);
    const transit = await inTransitByProduct(ctx.tenant.id);
    const levels = items.length ? await db.select().from(stockLevels).where(and(eq(stockLevels.tenantId, ctx.tenant.id), inArray(stockLevels.productId, items.map((i) => i.id)))) : [];
    return {
      items: items.map((p) => {
        const mine = levels.filter((l) => l.productId === p.id);
        // Utilizadores restritos veem o stock das suas unidades (o total da empresa continua visível).
        const visible = ctx.branchScope ? mine.filter((l) => ctx.branchScope!.includes(l.branchId)) : mine;
        return { ...p, centralQty: centralQty(p, mine), inTransit: transit.get(p.id) ?? 0, levels: visible.map((l) => ({ branchId: l.branchId, qty: l.qty })) };
      }),
      total: n,
    };
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
    const open = (await openTransfersByProduct(db, ctx.tenant.id, [id])).get(id);
    if (open) throw new AppError(409, "PRODUCT_IN_OPEN_TRANSFER", `O produto está em guias de transferência por concluir (${open.join(", ")}). Conclua-as ou cancele-as antes de o eliminar.`, { orders: open });
    const [p] = await db.update(products).set({ deletedAt: new Date() }).where(and(eq(products.id, id), eq(products.tenantId, ctx.tenant.id), isNull(products.deletedAt))).returning();
    if (!p) throw notFound();
    await audit({ ...auditBase(ctx), action: "product.deleted", entityType: "product", entityId: id, summary: `Produto ${p.sku} movido para a lixeira.` });
    return { ok: true };
  });

  app.post("/api/inventory/products/:id/adjust", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.adjust");
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ delta: z.number().int().min(-1e6).max(1e6).refine((v) => v !== 0, "O ajuste não pode ser zero."), reason: z.string().trim().min(3).max(200), branchId: z.string().uuid().nullable().optional() }), req.body);
    return adjustStock(ctx, id, body.delta, body.reason, "user", body.branchId);
  });

  /** Transferência de stock entre o armazém central e as unidades (o total da empresa mantém-se). */
  app.post("/api/inventory/transfers", async (req) => {
    const ctx = requireCtx(req);
    // Transferência imediata (sem guia): reservada a quem pode aprovar transferências.
    authorize(ctx, "inventory.approve_transfer");
    const body = parse(
      z.object({ productId: z.string().uuid(), fromBranchId: z.string().uuid().nullable(), toBranchId: z.string().uuid().nullable(), quantity: z.number().int().min(1).max(1e6), reason: z.string().trim().min(3).max(200) }),
      req.body,
    );
    // Utilizadores restritos não movimentam o armazém central nem unidades fora do âmbito.
    if (ctx.branchScope && (!body.fromBranchId || !body.toBranchId)) throw forbidden("Sem acesso ao armazém central.", "BRANCH_OUT_OF_SCOPE");
    const from = body.fromBranchId ? await resolveBranchForWrite(ctx, body.fromBranchId) : null;
    const to = body.toBranchId ? await resolveBranchForWrite(ctx, body.toBranchId) : null;
    return db.transaction(async (tx) => {
      const p = await lockProduct(tx, ctx.tenant.id, body.productId);
      await transfer(tx, ctx.tenant.id, p, from, to, body.quantity, body.reason, ctx.membership.id);
      await audit({ ...auditBase(ctx), action: "inventory.transferred", entityType: "product", entityId: p.id, summary: `Transferência de ${body.quantity} × ${p.name}: ${from ? "unidade" : "central"} → ${to ? "unidade" : "central"} (${body.reason}).`, metadata: { from, to, quantity: body.quantity } }, tx);
      return { ok: true };
    });
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
    const q = parse(pageQuery.extend({ branchId: z.string().uuid().optional() }), req.query);
    const where = and(eq(salesOrders.tenantId, ctx.tenant.id), isNull(salesOrders.deletedAt), branchCondition(ctx, salesOrders.branchId, q.branchId), q.q ? ilike(salesOrders.number, `%${q.q}%`) : undefined);
    const items = await db.select({ o: salesOrders, customer: customers.name }).from(salesOrders).leftJoin(customers, eq(customers.id, salesOrders.customerId))
      .where(where).orderBy(...orderFor(q, { number: salesOrders.number, soldAt: salesOrders.soldAt, total: salesOrders.total, customer: customers.name }, [desc(salesOrders.soldAt)], salesOrders.id)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
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
        branchId: z.string().uuid().nullable().optional(),
        lines: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(1e6) })).min(1).max(100),
      }),
      req.body,
    );
    const branchId = await resolveBranchForWrite(ctx, body.branchId);
    return db.transaction(async (tx) => {
      if (body.customerId) {
        const [c] = await tx.select({ id: customers.id }).from(customers).where(and(eq(customers.id, body.customerId), eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt)));
        if (!c) throw badRequest("Cliente inválido.");
      }
      // Numeração sequencial por empresa sem corridas entre vendas simultâneas
      await tx.execute(dsql`select pg_advisory_xact_lock(hashtext(${"sale:" + ctx.tenant.id}))`);
      const [{ n }] = await tx.select({ n: count() }).from(salesOrders).where(eq(salesOrders.tenantId, ctx.tenant.id));
      const orderId = randomUUID();
      const number = `V-${String(n + 1).padStart(5, "0")}`;
      const lines: SaleLine[] = [];
      for (const l of body.lines) {
        const p = await lockProduct(tx, ctx.tenant.id, l.productId).catch(() => {
          throw badRequest("Produto inválido.");
        });
        // A venda dá baixa no stock da unidade da venda (ou do armazém central se não tiver unidade).
        await applyMove(tx, { tenantId: ctx.tenant.id, product: p, branchId, delta: -l.quantity, reason: `Venda ${number}`, refType: "sale", refId: orderId, createdBy: ctx.membership.id });
        lines.push({ productId: p.id, name: p.name, quantity: l.quantity, unitPrice: p.unitPrice, total: Math.round(p.unitPrice * l.quantity * 100) / 100 });
      }
      const total = Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100;
      const [o] = await tx.insert(salesOrders).values({ id: orderId, tenantId: ctx.tenant.id, number, customerId: body.customerId ?? null, branchId, lines, total, createdBy: ctx.membership.id }).returning();
      await audit({ ...auditBase(ctx), action: "sale.created", entityType: "sale", entityId: o.id, summary: `Venda ${o.number} registada (${total}).` }, tx);
      return o;
    });
  });

  app.post("/api/sales/orders/:id/cancel", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "sales.cancel");
    const { id } = parse(uuidParam, req.params);
    return db.transaction(async (tx) => {
      const [o] = await tx.select().from(salesOrders).where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, ctx.tenant.id), eq(salesOrders.status, "confirmed"), branchCondition(ctx, salesOrders.branchId))).for("update");
      if (!o) throw notFound();
      for (const l of o.lines) {
        const p = await lockProduct(tx, ctx.tenant.id, l.productId);
        // Repõe o stock na mesma localização da venda
        await applyMove(tx, { tenantId: ctx.tenant.id, product: p, branchId: o.branchId, delta: l.quantity, reason: `Anulação ${o.number}`, refType: "sale_cancel", refId: o.id, createdBy: ctx.membership.id });
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
    const q = parse(pageQuery.extend({ kind: z.enum(["income", "expense"]).optional(), status: z.enum(["pending_approval", "approved", "rejected"]).optional(), branchId: z.string().uuid().optional() }), req.query);
    const where = and(
      eq(financeTransactions.tenantId, ctx.tenant.id),
      branchCondition(ctx, financeTransactions.branchId, q.branchId),
      isNull(financeTransactions.deletedAt),
      q.kind ? eq(financeTransactions.kind, q.kind) : undefined,
      q.status ? eq(financeTransactions.status, q.status) : undefined,
      q.q ? or(ilike(financeTransactions.category, `%${q.q}%`), ilike(financeTransactions.description, `%${q.q}%`)) : undefined,
    );
    const order = orderFor(q, { occurredOn: financeTransactions.occurredOn, amount: financeTransactions.amount, category: financeTransactions.category, kind: financeTransactions.kind }, [desc(financeTransactions.occurredOn), desc(financeTransactions.createdAt)], financeTransactions.id);
    const items = await db.select().from(financeTransactions).where(where).orderBy(...order).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
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
    const [t] = await db.select().from(financeTransactions).where(and(eq(financeTransactions.id, id), eq(financeTransactions.tenantId, ctx.tenant.id), eq(financeTransactions.status, "pending_approval"), isNull(financeTransactions.deletedAt), branchCondition(ctx, financeTransactions.branchId)));
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
    const [t] = await db.update(financeTransactions).set({ deletedAt: new Date() }).where(and(eq(financeTransactions.id, id), eq(financeTransactions.tenantId, ctx.tenant.id), isNull(financeTransactions.deletedAt), branchCondition(ctx, financeTransactions.branchId))).returning();
    if (!t) throw notFound();
    await audit({ ...auditBase(ctx), action: "finance.deleted", entityType: "finance_transaction", entityId: id, summary: `Movimento ${t.category} movido para a lixeira (retenção legal aplicável).` });
    return { ok: true };
  });
}

/** Guias de transferência por concluir (pedidas ou em trânsito) que contêm cada produto: id → números. */
export async function openTransfersByProduct(tx: DbOrTx, tenantId: string, productIds: string[]) {
  const out = new Map<string, string[]>();
  if (!productIds.length) return out;
  const open = await tx.select({ number: stockTransfers.number, lines: stockTransfers.lines }).from(stockTransfers)
    .where(and(eq(stockTransfers.tenantId, tenantId), inArray(stockTransfers.status, ["requested", "in_transit"])));
  for (const t of open) for (const l of t.lines) if (productIds.includes(l.productId)) out.set(l.productId, [...(out.get(l.productId) ?? []), t.number]);
  return out;
}
