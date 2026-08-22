import { and, desc, eq, isNull } from "drizzle-orm";
import { auditLogs, customers, financialEntries, inventory, products, sales, warehouses } from "../drizzle/schema";
import { getDb } from "./db";

export type ReportModule = "financeiro" | "vendas" | "stock" | "auditoria";

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers, ...rows].map(row => row.map(escape).join(";")).join("\r\n");
}

export async function buildCsvReport(companyId: number, module: ReportModule) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const stamp = new Date().toISOString().slice(0, 10);
  if (module === "financeiro") {
    const rows = await db.select().from(financialEntries).where(and(eq(financialEntries.companyId, companyId), isNull(financialEntries.deletedAt))).orderBy(desc(financialEntries.createdAt));
    return { filename: `nexora-financeiro-${stamp}.csv`, content: toCsv(["Tipo", "Categoria", "Descrição", "Valor", "Estado", "Vencimento"], rows.map(row => [row.type, row.category, row.description, row.amount, row.status, row.dueDate?.toISOString().slice(0, 10)])) };
  }
  if (module === "vendas") {
    const rows = await db.select({ code: sales.code, customer: customers.name, subtotal: sales.subtotal, tax: sales.taxAmount, total: sales.totalAmount, status: sales.status, createdAt: sales.createdAt }).from(sales).innerJoin(customers, eq(sales.customerId, customers.id)).where(and(eq(sales.companyId, companyId), isNull(sales.deletedAt))).orderBy(desc(sales.createdAt));
    return { filename: `nexora-vendas-${stamp}.csv`, content: toCsv(["Venda", "Cliente", "Subtotal", "Imposto", "Total", "Estado", "Data"], rows.map(row => [row.code, row.customer, row.subtotal, row.tax, row.total, row.status, row.createdAt.toISOString()])) };
  }
  if (module === "stock") {
    const rows = await db.select({ product: products.name, sku: products.sku, warehouse: warehouses.name, quantity: inventory.quantity, minimum: inventory.minimumQuantity }).from(inventory).innerJoin(products, eq(inventory.productId, products.id)).innerJoin(warehouses, eq(inventory.warehouseId, warehouses.id)).where(eq(inventory.companyId, companyId));
    return { filename: `nexora-stock-${stamp}.csv`, content: toCsv(["Produto", "SKU", "Armazém", "Stock", "Mínimo"], rows.map(row => [row.product, row.sku, row.warehouse, row.quantity, row.minimum])) };
  }
  const rows = await db.select().from(auditLogs).where(eq(auditLogs.companyId, companyId)).orderBy(desc(auditLogs.createdAt)).limit(2000);
  return { filename: `nexora-auditoria-${stamp}.csv`, content: toCsv(["Data", "Ação", "Entidade", "ID", "Resumo"], rows.map(row => [row.createdAt.toISOString(), row.action, row.entityType, row.entityId, row.summary])) };
}
