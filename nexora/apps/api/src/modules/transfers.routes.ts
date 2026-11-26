/**
 * Guias de transferência de stock com aprovação (segregação de funções):
 *   pedido (inventory.adjust) → expedição/aprovação por outra pessoa (inventory.approve_transfer):
 *   o stock sai da origem e fica "em trânsito" → receção no destino (inventory.adjust): entra no destino.
 * Durante o trânsito o total da empresa exclui as quantidades transportadas (não estão em nenhuma localização).
 */
import type { FastifyInstance } from "fastify";
import { and, count, desc, eq, inArray, or, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { branches, products, stockTransfers, type TransferLine } from "../db/schema.js";
import { audit } from "../core/audit.js";
import { auditBase, authorize, requireCtx, resolveBranchForWrite, type Ctx } from "../core/context.js";
import { AppError, badRequest, forbidden, notFound } from "../core/errors.js";
import { pageQuery, parse, uuidParam } from "../core/http.js";
import { applyMove, availableAt, lockProduct } from "../core/inventory.js";
import { notifyByPermission } from "../core/notify.js";
import { m, render, asLocale } from "../core/messages.js";
import { buildTransferGuidePdf, docLocale } from "../core/documents.js";

/** Um utilizador restrito por unidade só vê guias em que a origem ou o destino é uma das suas unidades. */
function scopeCondition(ctx: Ctx) {
  if (!ctx.branchScope) return undefined;
  return or(inArray(stockTransfers.fromBranchId, ctx.branchScope), inArray(stockTransfers.toBranchId, ctx.branchScope));
}

async function load(ctx: Ctx, id: string) {
  const [t] = await db.select().from(stockTransfers).where(and(eq(stockTransfers.id, id), eq(stockTransfers.tenantId, ctx.tenant.id), scopeCondition(ctx)));
  if (!t) throw notFound();
  return t;
}

const inScope = (ctx: Ctx, branchId: string | null) => !ctx.branchScope || (!!branchId && ctx.branchScope.includes(branchId));

/** Quantidades em trânsito por produto (guias expedidas e ainda não recebidas). */
export async function inTransitByProduct(tenantId: string) {
  const rows = await db.select({ lines: stockTransfers.lines }).from(stockTransfers).where(and(eq(stockTransfers.tenantId, tenantId), eq(stockTransfers.status, "in_transit")));
  const m = new Map<string, number>();
  for (const r of rows) for (const l of r.lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity);
  return m;
}

export async function transferRoutes(app: FastifyInstance) {
  app.get("/api/inventory/transfer-orders", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.view");
    const q = parse(pageQuery.extend({ status: z.enum(["requested", "in_transit", "received", "rejected", "canceled"]).optional() }), req.query);
    const where = and(eq(stockTransfers.tenantId, ctx.tenant.id), scopeCondition(ctx), q.status ? eq(stockTransfers.status, q.status) : undefined);
    const items = await db.select().from(stockTransfers).where(where).orderBy(desc(stockTransfers.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize);
    const [{ n }] = await db.select({ n: count() }).from(stockTransfers).where(where);
    return { items, total: n };
  });

  app.post("/api/inventory/transfer-orders", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.adjust");
    const b = parse(
      z.object({
        fromBranchId: z.string().uuid().nullable(),
        toBranchId: z.string().uuid().nullable(),
        lines: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(1e6) })).min(1).max(100),
        reason: z.string().trim().min(3).max(300),
        carrier: z.string().trim().max(160).optional(),
      }),
      req.body,
    );
    if (b.fromBranchId === b.toBranchId) throw badRequest("Origem e destino têm de ser diferentes.");
    // Utilizador restrito: pode pedir para as suas unidades ou a partir delas.
    if (ctx.branchScope && !inScope(ctx, b.fromBranchId) && !inScope(ctx, b.toBranchId)) throw forbidden("Unidades fora do seu âmbito.", "BRANCH_OUT_OF_SCOPE");
    for (const br of [b.fromBranchId, b.toBranchId]) {
      if (!br) continue;
      const [x] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, br), eq(branches.tenantId, ctx.tenant.id)));
      if (!x) throw badRequest("Unidade inválida.");
    }
    const ids = [...new Set(b.lines.map((l) => l.productId))];
    if (ids.length !== b.lines.length) throw badRequest("Produto repetido na guia.");
    const prods = await db.select().from(products).where(and(eq(products.tenantId, ctx.tenant.id), inArray(products.id, ids)));
    if (prods.length !== ids.length || prods.some((p) => p.deletedAt)) throw badRequest("Produto inválido.");
    const lines: TransferLine[] = b.lines.map((l) => {
      const p = prods.find((x) => x.id === l.productId)!;
      return { productId: p.id, sku: p.sku, name: p.name, quantity: l.quantity };
    });
    return db.transaction(async (tx) => {
      await tx.execute(dsql`select pg_advisory_xact_lock(hashtext(${"transfer:" + ctx.tenant.id}))`);
      const [{ n }] = await tx.select({ n: count() }).from(stockTransfers).where(eq(stockTransfers.tenantId, ctx.tenant.id));
      const [t] = await tx
        .insert(stockTransfers)
        .values({ tenantId: ctx.tenant.id, number: `GT-${String(n + 1).padStart(5, "0")}`, fromBranchId: b.fromBranchId, toBranchId: b.toBranchId, lines, reason: b.reason, carrier: b.carrier, requestedBy: ctx.membership.id })
        .returning();
      await audit({ ...auditBase(ctx), action: "transfer.requested", entityType: "stock_transfer", entityId: t.id, summary: `Guia ${t.number} pedida (${lines.length} produto(s)): ${b.reason}` }, tx);
      return t;
    }).then(async (t) => {
      await notifyByPermission(ctx.tenant.id, "inventory.approve_transfer", { type: "inventory.transfer_request", severity: "info", title: m("inventory.transfer_request.title", { number: t.number }), body: b.reason, link: "/app/products?tab=transfers", dedupeKey: `transfer:${t.id}` });
      return t;
    });
  });

  /** Aprovação = expedição: o stock sai da origem (fica em trânsito). Quem pede não aprova. */
  app.post("/api/inventory/transfer-orders/:id/approve", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.approve_transfer");
    const { id } = parse(uuidParam, req.params);
    const { carrier } = parse(z.object({ carrier: z.string().trim().max(160).optional() }), req.body ?? {});
    const t = await load(ctx, id);
    if (t.status !== "requested") throw new AppError(409, "ALREADY_PROCESSED", "Esta guia já foi processada.");
    if (t.requestedBy === ctx.membership.id) throw forbidden("Não pode aprovar uma transferência pedida por si (segregação de funções).", "SEGREGATION_OF_DUTIES");
    if (!inScope(ctx, t.fromBranchId)) throw forbidden("A origem está fora do seu âmbito.", "BRANCH_OUT_OF_SCOPE");
    return db.transaction(async (tx) => {
      const [claimed] = await tx.update(stockTransfers).set({ status: "in_transit", approvedBy: ctx.membership.id, shippedAt: new Date(), carrier: carrier ?? t.carrier })
        .where(and(eq(stockTransfers.id, id), eq(stockTransfers.status, "requested"))).returning();
      if (!claimed) throw new AppError(409, "ALREADY_PROCESSED", "Esta guia já foi processada.");
      for (const l of t.lines) {
        const p = await lockProduct(tx, ctx.tenant.id, l.productId);
        await applyMove(tx, { tenantId: ctx.tenant.id, product: p, branchId: t.fromBranchId, delta: -l.quantity, reason: `Guia ${t.number} (expedição)`, refType: "transfer_out", refId: t.id, createdBy: ctx.membership.id });
      }
      await audit({ ...auditBase(ctx), action: "transfer.shipped", entityType: "stock_transfer", entityId: t.id, summary: `Guia ${t.number} aprovada e expedida.` }, tx);
      return claimed;
    });
  });

  app.post("/api/inventory/transfer-orders/:id/reject", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.approve_transfer");
    const { id } = parse(uuidParam, req.params);
    const { note } = parse(z.object({ note: z.string().trim().min(3).max(300) }), req.body);
    const t = await load(ctx, id);
    const [r] = await db.update(stockTransfers).set({ status: "rejected", approvedBy: ctx.membership.id, decisionNote: note }).where(and(eq(stockTransfers.id, t.id), eq(stockTransfers.status, "requested"))).returning();
    if (!r) throw new AppError(409, "ALREADY_PROCESSED", "Esta guia já foi processada.");
    await audit({ ...auditBase(ctx), action: "transfer.rejected", entityType: "stock_transfer", entityId: t.id, summary: `Guia ${t.number} rejeitada: ${note}` });
    return r;
  });

  app.post("/api/inventory/transfer-orders/:id/cancel", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.adjust");
    const { id } = parse(uuidParam, req.params);
    const t = await load(ctx, id);
    if (t.requestedBy !== ctx.membership.id) throw forbidden("Só quem pediu pode cancelar.");
    const [r] = await db.update(stockTransfers).set({ status: "canceled" }).where(and(eq(stockTransfers.id, t.id), eq(stockTransfers.status, "requested"))).returning();
    if (!r) throw new AppError(409, "ALREADY_PROCESSED", "Esta guia já foi processada.");
    await audit({ ...auditBase(ctx), action: "transfer.canceled", entityType: "stock_transfer", entityId: t.id, summary: `Guia ${t.number} cancelada pelo requerente.` });
    return r;
  });

  /** Receção no destino: o stock em trânsito entra na localização de destino. */
  app.post("/api/inventory/transfer-orders/:id/receive", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.adjust");
    const { id } = parse(uuidParam, req.params);
    // Sem `lines`, recebe-se tudo o que foi expedido. Com `lines`, indica-se o recebido por produto.
    const body = parse(
      z.object({
        lines: z.array(z.object({ productId: z.string().uuid(), received: z.number().int().min(0) })).max(100).optional(),
        note: z.string().trim().max(500).optional(),
      }),
      req.body ?? {},
    );
    const t = await load(ctx, id);
    if (t.status !== "in_transit") throw new AppError(409, "ALREADY_PROCESSED", "Só guias expedidas podem ser recebidas.");
    if (!inScope(ctx, t.toBranchId)) throw forbidden("O destino está fora do seu âmbito.", "BRANCH_OUT_OF_SCOPE");
    const given = new Map((body.lines ?? []).map((l) => [l.productId, l.received]));
    for (const pid of given.keys()) if (!t.lines.some((l) => l.productId === pid)) throw badRequest("Produto que não consta da guia.");
    const lines: TransferLine[] = t.lines.map((l) => {
      const received = given.get(l.productId) ?? l.quantity;
      if (received > l.quantity) throw new AppError(400, "RECEIVED_EXCEEDS_SHIPPED", `Não pode receber mais do que foi expedido (${l.sku}: ${l.quantity}).`);
      return { ...l, received };
    });
    const shortfall = lines.filter((l) => l.received! < l.quantity);
    if (shortfall.length && (body.note ?? "").length < 3) throw new AppError(400, "RECEIPT_NOTE_REQUIRED", "Indique o motivo da diferença entre o expedido e o recebido.");
    const result = await db.transaction(async (tx) => {
      const [claimed] = await tx.update(stockTransfers).set({ status: "received", lines, receiptNote: shortfall.length ? body.note : (body.note || null), receivedBy: ctx.membership.id, receivedAt: new Date() })
        .where(and(eq(stockTransfers.id, id), eq(stockTransfers.status, "in_transit"))).returning();
      if (!claimed) throw new AppError(409, "ALREADY_PROCESSED", "Esta guia já foi processada.");
      for (const l of lines) {
        if (!l.received) continue;
        const p = await lockProduct(tx, ctx.tenant.id, l.productId);
        await applyMove(tx, { tenantId: ctx.tenant.id, product: p, branchId: t.toBranchId, delta: l.received, reason: `Guia ${t.number} (receção)`, refType: "transfer_in", refId: t.id, createdBy: ctx.membership.id });
      }
      await audit({ ...auditBase(ctx), action: "transfer.received", entityType: "stock_transfer", entityId: t.id, summary: `Guia ${t.number} recebida no destino.` }, tx);
      // A diferença já saiu da origem na expedição e não entra no destino: fica registada como perda em trânsito.
      if (shortfall.length)
        await audit({
          ...auditBase(ctx),
          action: "transfer.discrepancy",
          entityType: "stock_transfer",
          entityId: t.id,
          summary: `Guia ${t.number}: receção com diferenças — ${shortfall.map((l) => `${l.sku} ${l.received}/${l.quantity}`).join(", ")}. Motivo: ${body.note}`,
          metadata: { lines: shortfall.map((l) => ({ sku: l.sku, shipped: l.quantity, received: l.received, lost: l.quantity - l.received! })) },
        }, tx);
      return claimed;
    });
    if (shortfall.length)
      await notifyByPermission(ctx.tenant.id, "inventory.approve_transfer", {
        type: "inventory.transfer_discrepancy",
        severity: "warning",
        title: m("inventory.transfer_discrepancy.title", { number: t.number }),
        body: m("inventory.transfer_discrepancy.body", { lines: shortfall.map((l) => `${l.sku} ${l.received}/${l.quantity}`).join(", "), note: body.note! }),
        link: "/app/products?tab=transfers",
        dedupeKey: `transfer-discrepancy:${t.id}`,
      });
    return result;
  });

  /** Guia de transporte em PDF. */
  app.get("/api/inventory/transfer-orders/:id/guide", async (req, reply) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.view", "export");
    const { id } = parse(uuidParam, req.params);
    const t = await load(ctx, id);
    const brs = await db.select().from(branches).where(eq(branches.tenantId, ctx.tenant.id));
    const name = (bid: string | null) => (bid ? (brs.find((b) => b.id === bid)?.name ?? "—") : ctx.user.locale === "en" ? "Central warehouse" : "Armazém central");
    const pdf = await buildTransferGuidePdf(t, { company: ctx.tenant.legalName || ctx.tenant.name, taxId: ctx.tenant.taxId, from: name(t.fromBranchId), to: name(t.toBranchId) }, docLocale(ctx.user.locale));
    reply.header("content-type", "application/pdf").header("content-disposition", `attachment; filename="guia-${t.number}.pdf"`).header("cache-control", "private, no-store");
    return pdf;
  });

  void availableAt;
}
