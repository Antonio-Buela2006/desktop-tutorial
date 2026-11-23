/**
 * Stock por localização. Invariante: products.stock_qty = total da empresa =
 * armazém central + Σ stock_levels. Todas as operações bloqueiam a linha do produto
 * (SELECT … FOR UPDATE), o que serializa movimentos concorrentes do mesmo produto.
 */
import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "../db/client.js";
import { products, stockLevels, stockMovements } from "../db/schema.js";
import { AppError, notFound } from "./errors.js";

type Product = typeof products.$inferSelect;

export async function lockProduct(tx: DbOrTx, tenantId: string, productId: string): Promise<Product> {
  const [p] = await tx.select().from(products).where(and(eq(products.id, productId), eq(products.tenantId, tenantId))).for("update");
  if (!p || p.deletedAt) throw notFound();
  return p;
}

export async function levelsOf(tx: DbOrTx, productId: string) {
  return tx.select().from(stockLevels).where(eq(stockLevels.productId, productId));
}

export function centralQty(p: Product, levels: { qty: number }[]) {
  return p.stockQty - levels.reduce((s, l) => s + l.qty, 0);
}

/** Quantidade disponível numa localização (null = armazém central). */
export async function availableAt(tx: DbOrTx, p: Product, branchId: string | null) {
  const levels = await levelsOf(tx, p.id);
  if (!branchId) return centralQty(p, levels);
  return levels.find((l) => l.branchId === branchId)?.qty ?? 0;
}

type Move = { tenantId: string; product: Product; branchId: string | null; delta: number; reason: string; refType?: string; refId?: string; createdBy?: string; affectTotal?: boolean; productName?: string };

/**
 * Aplica um movimento numa localização. affectTotal=false é usado nas transferências
 * (o total da empresa não muda). Recusa stock negativo na localização.
 */
export async function applyMove(tx: DbOrTx, m: Move) {
  const available = await availableAt(tx, m.product, m.branchId);
  if (available + m.delta < 0)
    throw new AppError(409, "INSUFFICIENT_STOCK", `Stock insuficiente para ${m.productName ?? m.product.name} ${m.branchId ? "nesta unidade" : "no armazém central"} (disponível: ${available}).`, { available });
  if (m.branchId) {
    await tx
      .insert(stockLevels)
      .values({ tenantId: m.tenantId, productId: m.product.id, branchId: m.branchId, qty: m.delta })
      .onConflictDoUpdate({ target: [stockLevels.productId, stockLevels.branchId], set: { qty: available + m.delta } });
  }
  if (m.affectTotal !== false) {
    const [u] = await tx.update(products).set({ stockQty: m.product.stockQty + m.delta }).where(eq(products.id, m.product.id)).returning();
    m.product.stockQty = u.stockQty;
  }
  await tx.insert(stockMovements).values({ tenantId: m.tenantId, productId: m.product.id, branchId: m.branchId, delta: m.delta, reason: m.reason, refType: m.refType, refId: m.refId, createdBy: m.createdBy });
}

/** Transferência entre localizações (o total da empresa mantém-se). */
export async function transfer(tx: DbOrTx, tenantId: string, product: Product, from: string | null, to: string | null, qty: number, reason: string, createdBy: string) {
  if (from === to) throw new AppError(400, "BAD_REQUEST", "Origem e destino têm de ser diferentes.");
  if (qty <= 0) throw new AppError(400, "BAD_REQUEST", "Quantidade inválida.");
  const ref = { refType: "transfer", createdBy };
  await applyMove(tx, { tenantId, product, branchId: from, delta: -qty, reason: `Transferência (saída): ${reason}`, affectTotal: false, ...ref });
  await applyMove(tx, { tenantId, product, branchId: to, delta: qty, reason: `Transferência (entrada): ${reason}`, affectTotal: false, ...ref });
}
