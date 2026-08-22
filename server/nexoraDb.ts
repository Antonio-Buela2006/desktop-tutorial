import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import {
  attendances,
  auditLogs,
  companies,
  customers,
  deliveries,
  employees,
  financialEntries,
  inventory,
  invoices,
  ledgerEntries,
  leaveRequests,
  memberships,
  products,
  performanceReviews,
  saleItems,
  sales,
  stockMovements,
  suppliers,
  users,
  warehouses,
} from "../drizzle/schema";
import type { BusinessRole } from "./rbac";
import { getDb } from "./db";
import { buildDoubleEntryLines, calculateSaleTotals } from "./salesMath";

const asNumber = (value: unknown) => Number(value ?? 0);

export type Workspace = {
  companyId: number;
  companyName: string;
  currency: string;
  role: BusinessRole;
};

export async function getWorkspace(userId: number): Promise<Workspace | null> {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");

  const rows = await db
    .select({
      companyId: companies.id,
      companyName: companies.name,
      currency: companies.currency,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(companies, eq(memberships.companyId, companies.id))
    .where(and(eq(memberships.userId, userId), eq(memberships.active, true), isNull(companies.deletedAt)))
    .limit(1);

  return rows[0] ? { ...rows[0], role: rows[0].role as BusinessRole } : null;
}

export async function listTeamMembers(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  return db.select({ membershipId: memberships.id, userId: users.id, name: users.name, email: users.email, role: memberships.role, active: memberships.active }).from(memberships).innerJoin(users, eq(memberships.userId, users.id)).where(eq(memberships.companyId, companyId));
}

export async function assignTeamRole(input: { companyId: number; actorId: number; email: string; role: BusinessRole }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const member = (await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.email, input.email)).limit(1))[0];
  if (!member) throw new Error("O utilizador deve iniciar sessão pelo menos uma vez antes de ser associado à empresa.");
  await db.insert(memberships).values({ companyId: input.companyId, userId: member.id, role: input.role, active: true }).onDuplicateKeyUpdate({ set: { role: input.role, active: true } });
  await writeAudit({ companyId: input.companyId, actorId: input.actorId, action: "equipa.perfil.atribuido", entityType: "membro", entityId: member.id, summary: `Perfil ${input.role} atribuído a ${member.name || input.email}.` });
}

export async function createWorkspace(input: {
  userId: number;
  companyName: string;
  sector?: string;
  taxNumber?: string;
  email?: string;
  phone?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");

  return db.transaction(async tx => {
    const companyResult = await tx.insert(companies).values({
      name: input.companyName,
      sector: input.sector || null,
      taxNumber: input.taxNumber || null,
      email: input.email || null,
      phone: input.phone || null,
      createdBy: input.userId,
    });
    const companyId = Number(companyResult[0].insertId);

    await tx.insert(memberships).values({
      companyId,
      userId: input.userId,
      role: "administrador",
    });
    await tx.insert(warehouses).values({
      companyId,
      name: "Armazém principal",
      location: "A configurar",
    });
    await tx.insert(auditLogs).values({
      companyId,
      actorId: input.userId,
      action: "empresa.criada",
      entityType: "empresa",
      entityId: String(companyId),
      summary: "Empresa configurada no NEXORA.",
      metadata: { source: "onboarding" },
    });

    return { companyId, role: "administrador" as BusinessRole };
  });
}

export async function writeAudit(input: {
  companyId: number;
  actorId: number;
  action: string;
  entityType: string;
  entityId?: string | number;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  await db.insert(auditLogs).values({
    companyId: input.companyId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId === undefined ? null : String(input.entityId),
    summary: input.summary,
    metadata: input.metadata,
  });
}

export async function getDashboard(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const [financeRows, stockRows, openInvoices, deliveryRows, recentSales] = await Promise.all([
    db.select().from(financialEntries).where(and(eq(financialEntries.companyId, companyId), isNull(financialEntries.deletedAt))),
    db.select({ id: inventory.id, quantity: inventory.quantity, minimumQuantity: inventory.minimumQuantity, name: products.name, sku: products.sku })
      .from(inventory).innerJoin(products, eq(inventory.productId, products.id)).where(eq(inventory.companyId, companyId)),
    db.select().from(invoices).where(and(eq(invoices.companyId, companyId), eq(invoices.status, "pendente"))),
    db.select().from(deliveries).where(and(eq(deliveries.companyId, companyId), eq(deliveries.status, "agendada"))),
    db.select({ id: sales.id, code: sales.code, totalAmount: sales.totalAmount, createdAt: sales.createdAt, customerName: customers.name })
      .from(sales).innerJoin(customers, eq(sales.customerId, customers.id))
      .where(and(eq(sales.companyId, companyId), isNull(sales.deletedAt))).orderBy(desc(sales.createdAt)).limit(6),
  ]);

  const revenue = financeRows.filter(row => row.type === "receita").reduce((sum, row) => sum + asNumber(row.amount), 0);
  const expenses = financeRows.filter(row => row.type === "despesa").reduce((sum, row) => sum + asNumber(row.amount), 0);
  const criticalStock = stockRows.filter(row => row.quantity <= row.minimumQuantity);
  const overdue = financeRows.filter(row => row.status !== "pago" && row.dueDate && new Date(row.dueDate) < new Date()).length;

  return {
    kpis: {
      revenue, expenses, margin: revenue - expenses, criticalStock: criticalStock.length,
      pendingTasks: openInvoices.length + deliveryRows.length + overdue,
    },
    criticalStock,
    recentSales: recentSales.map(sale => ({ ...sale, totalAmount: asNumber(sale.totalAmount) })),
    activity: [
      { label: "Faturas pendentes", value: openInvoices.length, tone: "amber" },
      { label: "Entregas agendadas", value: deliveryRows.length, tone: "blue" },
      { label: "Pagamentos em atraso", value: overdue, tone: overdue ? "red" : "green" },
    ],
  };
}

export async function listCustomers(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  return db.select().from(customers).where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt))).orderBy(desc(customers.createdAt));
}

export async function addCustomer(input: { companyId: number; actorId: number; name: string; taxNumber?: string; email?: string; phone?: string; address?: string; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const result = await db.insert(customers).values({ ...input, taxNumber: input.taxNumber || null, email: input.email || null, phone: input.phone || null, address: input.address || null, notes: input.notes || null });
  const id = Number(result[0].insertId);
  await writeAudit({ companyId: input.companyId, actorId: input.actorId, action: "cliente.criado", entityType: "cliente", entityId: id, summary: `Cliente ${input.name} registado.` });
  return { id };
}

export async function listCatalog(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const [productRows, warehouseRows, stockRows, supplierRows] = await Promise.all([
    db.select().from(products).where(and(eq(products.companyId, companyId), isNull(products.deletedAt))).orderBy(desc(products.createdAt)),
    db.select().from(warehouses).where(and(eq(warehouses.companyId, companyId), isNull(warehouses.deletedAt))),
    db.select({ id: inventory.id, productId: inventory.productId, warehouseId: inventory.warehouseId, quantity: inventory.quantity, minimumQuantity: inventory.minimumQuantity, productName: products.name, warehouseName: warehouses.name })
      .from(inventory).innerJoin(products, eq(inventory.productId, products.id)).innerJoin(warehouses, eq(inventory.warehouseId, warehouses.id))
      .where(eq(inventory.companyId, companyId)),
    db.select().from(suppliers).where(and(eq(suppliers.companyId, companyId), isNull(suppliers.deletedAt))),
  ]);
  return { products: productRows.map(row => ({ ...row, salePrice: asNumber(row.salePrice), costPrice: asNumber(row.costPrice) })), warehouses: warehouseRows, inventory: stockRows, suppliers: supplierRows };
}

export async function addProduct(input: { companyId: number; actorId: number; sku: string; name: string; salePrice: number; costPrice: number; description?: string; warehouseId: number; openingQuantity: number; minimumQuantity: number }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  return db.transaction(async tx => {
    const warehouse = await tx.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, input.warehouseId), eq(warehouses.companyId, input.companyId))).limit(1);
    if (!warehouse[0]) throw new Error("Armazém inválido para esta empresa.");
    const result = await tx.insert(products).values({ companyId: input.companyId, sku: input.sku, name: input.name, salePrice: input.salePrice.toFixed(2), costPrice: input.costPrice.toFixed(2), description: input.description || null });
    const productId = Number(result[0].insertId);
    const inventoryResult = await tx.insert(inventory).values({ companyId: input.companyId, productId, warehouseId: input.warehouseId, quantity: input.openingQuantity, minimumQuantity: input.minimumQuantity });
    const inventoryId = Number(inventoryResult[0].insertId);
    if (input.openingQuantity > 0) {
      await tx.insert(stockMovements).values({ companyId: input.companyId, inventoryId, type: "entrada", quantity: input.openingQuantity, reference: "Stock inicial", createdBy: input.actorId });
    }
    await tx.insert(auditLogs).values({ companyId: input.companyId, actorId: input.actorId, action: "produto.criado", entityType: "produto", entityId: String(productId), summary: `Produto ${input.name} registado com stock inicial.`, metadata: { sku: input.sku, openingQuantity: input.openingQuantity } });
    return { productId };
  });
}

export async function addWarehouse(input: { companyId: number; actorId: number; name: string; location?: string }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const result = await db.insert(warehouses).values({ companyId: input.companyId, name: input.name, location: input.location || null });
  const id = Number(result[0].insertId);
  await writeAudit({ companyId: input.companyId, actorId: input.actorId, action: "armazem.criado", entityType: "armazem", entityId: id, summary: `Armazém ${input.name} registado.` });
  return { id };
}

export async function addInventoryAdjustment(input: { companyId: number; actorId: number; inventoryId: number; quantity: number; note: string }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  return db.transaction(async tx => {
    const current = await tx.select().from(inventory).where(and(eq(inventory.id, input.inventoryId), eq(inventory.companyId, input.companyId))).limit(1);
    if (!current[0]) throw new Error("Registo de stock inválido.");
    if (current[0].quantity + input.quantity < 0) throw new Error("O ajuste deixaria o stock negativo.");
    await tx.update(inventory).set({ quantity: sql`${inventory.quantity} + ${input.quantity}` }).where(eq(inventory.id, input.inventoryId));
    await tx.insert(stockMovements).values({ companyId: input.companyId, inventoryId: input.inventoryId, type: "ajuste", quantity: input.quantity, reference: input.note, createdBy: input.actorId });
    await tx.insert(auditLogs).values({ companyId: input.companyId, actorId: input.actorId, action: "stock.ajustado", entityType: "inventario", entityId: String(input.inventoryId), summary: `Ajuste de stock de ${input.quantity} unidades.`, metadata: { note: input.note } });
  });
}

export async function listFinance(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const rows = await db.select().from(financialEntries).where(and(eq(financialEntries.companyId, companyId), isNull(financialEntries.deletedAt))).orderBy(desc(financialEntries.createdAt));
  const revenue = rows.filter(row => row.type === "receita").reduce((sum, row) => sum + asNumber(row.amount), 0);
  const expenses = rows.filter(row => row.type === "despesa").reduce((sum, row) => sum + asNumber(row.amount), 0);
  const receivable = rows.filter(row => row.type === "receita" && row.status !== "pago").reduce((sum, row) => sum + asNumber(row.amount), 0);
  const payable = rows.filter(row => row.type === "despesa" && row.status !== "pago").reduce((sum, row) => sum + asNumber(row.amount), 0);
  return { rows: rows.map(row => ({ ...row, amount: asNumber(row.amount) })), summary: { revenue, expenses, cashFlow: revenue - expenses, receivable, payable } };
}

export async function addFinancialEntry(input: { companyId: number; actorId: number; type: "receita" | "despesa"; category: string; description: string; amount: number; dueDate?: string; status: "pendente" | "pago" }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const result = await db.insert(financialEntries).values({ companyId: input.companyId, type: input.type, category: input.category, description: input.description, amount: input.amount.toFixed(2), status: input.status, dueDate: input.dueDate ? new Date(input.dueDate) : null, paidAt: input.status === "pago" ? new Date() : null, createdBy: input.actorId });
  const id = Number(result[0].insertId);
  await writeAudit({ companyId: input.companyId, actorId: input.actorId, action: `${input.type}.criada`, entityType: "financeiro", entityId: id, summary: `${input.type === "receita" ? "Receita" : "Despesa"} ${input.description} registada.` });
  return { id };
}

export async function listSales(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const rows = await db.select({ id: sales.id, code: sales.code, status: sales.status, subtotal: sales.subtotal, taxAmount: sales.taxAmount, totalAmount: sales.totalAmount, createdAt: sales.createdAt, customerName: customers.name })
    .from(sales).innerJoin(customers, eq(sales.customerId, customers.id))
    .where(and(eq(sales.companyId, companyId), isNull(sales.deletedAt))).orderBy(desc(sales.createdAt));
  return rows.map(row => ({ ...row, subtotal: asNumber(row.subtotal), taxAmount: asNumber(row.taxAmount), totalAmount: asNumber(row.totalAmount) }));
}

export async function listAccounting(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const [invoiceRows, ledgerRows] = await Promise.all([
    db.select({ id: invoices.id, code: invoices.code, status: invoices.status, issuedAt: invoices.issuedAt, dueDate: invoices.dueDate, totalAmount: invoices.totalAmount, saleCode: sales.code, customerName: customers.name })
      .from(invoices).innerJoin(sales, eq(invoices.saleId, sales.id)).innerJoin(customers, eq(sales.customerId, customers.id))
      .where(and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt))).orderBy(desc(invoices.issuedAt)),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.companyId, companyId)).orderBy(desc(ledgerEntries.postedAt)).limit(150),
  ]);
  return {
    invoices: invoiceRows.map(row => ({ ...row, totalAmount: asNumber(row.totalAmount) })),
    ledger: ledgerRows.map(row => ({ ...row, debit: asNumber(row.debit), credit: asNumber(row.credit) })),
  };
}

export async function createIntegratedSale(input: { companyId: number; actorId: number; customerId: number; items: Array<{ productId: number; warehouseId: number; quantity: number }>; notes?: string; deliveryAddress?: string }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  if (!input.items.length) throw new Error("A venda deve incluir pelo menos um produto.");
  return db.transaction(async tx => {
    const customer = await tx.select({ id: customers.id, address: customers.address }).from(customers).where(and(eq(customers.id, input.customerId), eq(customers.companyId, input.companyId), isNull(customers.deletedAt))).limit(1);
    if (!customer[0]) throw new Error("Cliente inválido para esta empresa.");

    const preparedItems: Array<{ productId: number; warehouseId: number; quantity: number; unitPrice: number; lineTotal: number; inventoryId: number }> = [];
    for (const item of input.items) {
      const stock = await tx.select({ inventoryId: inventory.id, quantity: inventory.quantity, salePrice: products.salePrice })
        .from(inventory).innerJoin(products, eq(inventory.productId, products.id))
        .where(and(eq(inventory.companyId, input.companyId), eq(inventory.productId, item.productId), eq(inventory.warehouseId, item.warehouseId))).limit(1);
      if (!stock[0]) throw new Error("Produto ou armazém não encontrado.");
      if (stock[0].quantity < item.quantity) throw new Error("Stock insuficiente para concluir a venda.");
      const unitPrice = asNumber(stock[0].salePrice);
      preparedItems.push({ productId: item.productId, warehouseId: item.warehouseId, quantity: item.quantity, unitPrice, lineTotal: unitPrice * item.quantity, inventoryId: stock[0].inventoryId });
    }
    const { subtotal, taxAmount, totalAmount } = calculateSaleTotals(preparedItems);
    const code = `VND-${Date.now().toString().slice(-8)}`;
    const saleResult = await tx.insert(sales).values({ companyId: input.companyId, customerId: input.customerId, code, status: "concluido", subtotal: subtotal.toFixed(2), taxAmount: taxAmount.toFixed(2), totalAmount: totalAmount.toFixed(2), notes: input.notes || null, createdBy: input.actorId });
    const saleId = Number(saleResult[0].insertId);

    for (const item of preparedItems) {
      await tx.insert(saleItems).values({ saleId, productId: item.productId, warehouseId: item.warehouseId, quantity: item.quantity, unitPrice: item.unitPrice.toFixed(2), lineTotal: item.lineTotal.toFixed(2) });
      await tx.update(inventory).set({ quantity: sql`${inventory.quantity} - ${item.quantity}` }).where(eq(inventory.id, item.inventoryId));
      await tx.insert(stockMovements).values({ companyId: input.companyId, inventoryId: item.inventoryId, type: "saida", quantity: -item.quantity, reference: code, createdBy: input.actorId });
    }

    const invoiceCode = `FAT-${Date.now().toString().slice(-8)}`;
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
    const invoiceResult = await tx.insert(invoices).values({ companyId: input.companyId, saleId, code: invoiceCode, status: "pendente", totalAmount: totalAmount.toFixed(2), dueDate });
    const invoiceId = Number(invoiceResult[0].insertId);
    await tx.insert(financialEntries).values({ companyId: input.companyId, saleId, type: "receita", category: "Vendas", description: `Receita da venda ${code}`, amount: totalAmount.toFixed(2), status: "pendente", dueDate, createdBy: input.actorId });
    const accountingLines = buildDoubleEntryLines(totalAmount, subtotal, taxAmount);
    await tx.insert(ledgerEntries).values([
      { companyId: input.companyId, saleId, invoiceId, accountCode: accountingLines[0].accountCode, accountName: "Clientes", debit: accountingLines[0].debit.toFixed(2), credit: accountingLines[0].credit.toFixed(2), description: `Venda ${code} — conta a receber`, createdBy: input.actorId },
      { companyId: input.companyId, saleId, invoiceId, accountCode: accountingLines[1].accountCode, accountName: "Vendas de mercadorias", debit: accountingLines[1].debit.toFixed(2), credit: accountingLines[1].credit.toFixed(2), description: `Venda ${code} — receita`, createdBy: input.actorId },
      { companyId: input.companyId, saleId, invoiceId, accountCode: accountingLines[2].accountCode, accountName: "IVA liquidado", debit: accountingLines[2].debit.toFixed(2), credit: accountingLines[2].credit.toFixed(2), description: `Venda ${code} — IVA`, createdBy: input.actorId },
    ]);
    const deliveryResult = await tx.insert(deliveries).values({ companyId: input.companyId, saleId, status: "agendada", scheduledAt: new Date(), trackingCode: `ENT-${saleId}-${Date.now().toString().slice(-5)}`, address: input.deliveryAddress || customer[0].address || null });
    const deliveryId = Number(deliveryResult[0].insertId);
    await tx.insert(auditLogs).values({ companyId: input.companyId, actorId: input.actorId, action: "venda.integrada.registada", entityType: "venda", entityId: String(saleId), summary: `Venda ${code} integrada: stock, fatura, contabilidade e entrega atualizados.`, metadata: { invoiceId, deliveryId, totalAmount } });
    return { saleId, code, invoiceId, invoiceCode, deliveryId, totalAmount };
  });
}

export async function listHumanResources(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  return db.select().from(employees).where(and(eq(employees.companyId, companyId), isNull(employees.deletedAt))).orderBy(desc(employees.createdAt));
}

export async function addEmployee(input: { companyId: number; actorId: number; fullName: string; email?: string; jobTitle?: string; hiredAt?: string }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const result = await db.insert(employees).values({ companyId: input.companyId, fullName: input.fullName, email: input.email || null, jobTitle: input.jobTitle || null, hiredAt: input.hiredAt ? new Date(input.hiredAt) : null });
  const id = Number(result[0].insertId);
  await writeAudit({ companyId: input.companyId, actorId: input.actorId, action: "funcionario.criado", entityType: "funcionario", entityId: id, summary: `Funcionário ${input.fullName} registado.` });
  return { id };
}

export async function getHumanResourcesData(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const [employeeRows, attendanceRows, leaveRows, reviewRows] = await Promise.all([
    db.select().from(employees).where(and(eq(employees.companyId, companyId), isNull(employees.deletedAt))).orderBy(desc(employees.createdAt)),
    db.select().from(attendances).where(eq(attendances.companyId, companyId)).orderBy(desc(attendances.createdAt)).limit(100),
    db.select().from(leaveRequests).where(and(eq(leaveRequests.companyId, companyId), isNull(leaveRequests.deletedAt))).orderBy(desc(leaveRequests.createdAt)).limit(100),
    db.select().from(performanceReviews).where(eq(performanceReviews.companyId, companyId)).orderBy(desc(performanceReviews.reviewedAt)).limit(100),
  ]);
  return { employees: employeeRows, attendances: attendanceRows, leaveRequests: leaveRows, performanceReviews: reviewRows };
}

async function requireCompanyEmployee(companyId: number, employeeId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const employee = (await db.select({ id: employees.id, fullName: employees.fullName }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId), isNull(employees.deletedAt))).limit(1))[0];
  if (!employee) throw new Error("Funcionário inválido para esta empresa.");
  return employee;
}

export async function addAttendance(input: { companyId: number; actorId: number; employeeId: number; date: string; status: "presente" | "ausente" | "justificado" | "remoto"; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const employee = await requireCompanyEmployee(input.companyId, input.employeeId);
  await db.insert(attendances).values({ companyId: input.companyId, employeeId: input.employeeId, date: new Date(input.date), status: input.status, notes: input.notes || null }).onDuplicateKeyUpdate({ set: { status: input.status, notes: input.notes || null } });
  await writeAudit({ companyId: input.companyId, actorId: input.actorId, action: "rh.presenca.registada", entityType: "presenca", entityId: input.employeeId, summary: `Presença de ${employee.fullName} registada como ${input.status}.` });
}

export async function createLeaveRequest(input: { companyId: number; actorId: number; employeeId: number; startDate: string; endDate: string; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const employee = await requireCompanyEmployee(input.companyId, input.employeeId);
  const result = await db.insert(leaveRequests).values({ companyId: input.companyId, employeeId: input.employeeId, startDate: new Date(input.startDate), endDate: new Date(input.endDate), status: "pendente", notes: input.notes || null });
  const id = Number(result[0].insertId);
  await writeAudit({ companyId: input.companyId, actorId: input.actorId, action: "rh.ferias.solicitadas", entityType: "ferias", entityId: id, summary: `Pedido de férias criado para ${employee.fullName}.` });
  return { id };
}

export async function createPerformanceReview(input: { companyId: number; actorId: number; employeeId: number; score: number; comments?: string }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const employee = await requireCompanyEmployee(input.companyId, input.employeeId);
  const result = await db.insert(performanceReviews).values({ companyId: input.companyId, employeeId: input.employeeId, reviewerId: input.actorId, score: input.score, comments: input.comments || null });
  const id = Number(result[0].insertId);
  await writeAudit({ companyId: input.companyId, actorId: input.actorId, action: "rh.avaliacao.criada", entityType: "avaliacao", entityId: id, summary: `Avaliação de desempenho registada para ${employee.fullName}.`, metadata: { score: input.score } });
  return { id };
}

export async function listLogistics(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const [deliveryRows, supplierRows] = await Promise.all([
    db.select({ id: deliveries.id, status: deliveries.status, scheduledAt: deliveries.scheduledAt, deliveredAt: deliveries.deliveredAt, trackingCode: deliveries.trackingCode, address: deliveries.address, saleCode: sales.code, customerName: customers.name })
      .from(deliveries).innerJoin(sales, eq(deliveries.saleId, sales.id)).innerJoin(customers, eq(sales.customerId, customers.id))
      .where(and(eq(deliveries.companyId, companyId), isNull(deliveries.deletedAt))).orderBy(desc(deliveries.createdAt)),
    db.select().from(suppliers).where(and(eq(suppliers.companyId, companyId), isNull(suppliers.deletedAt))),
  ]);
  return { deliveries: deliveryRows, suppliers: supplierRows };
}

export async function addSupplier(input: { companyId: number; actorId: number; name: string; taxNumber?: string; email?: string; phone?: string; address?: string }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const result = await db.insert(suppliers).values({ companyId: input.companyId, name: input.name, taxNumber: input.taxNumber || null, email: input.email || null, phone: input.phone || null, address: input.address || null });
  const id = Number(result[0].insertId);
  await writeAudit({ companyId: input.companyId, actorId: input.actorId, action: "fornecedor.criado", entityType: "fornecedor", entityId: id, summary: `Fornecedor ${input.name} registado.` });
  return { id };
}

export async function listAudit(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  return db.select().from(auditLogs).where(eq(auditLogs.companyId, companyId)).orderBy(desc(auditLogs.createdAt)).limit(150);
}

export async function getOverdueFinancialEntries(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  return db.select().from(financialEntries).where(and(eq(financialEntries.companyId, companyId), eq(financialEntries.status, "pendente"), lt(financialEntries.dueDate, new Date()), isNull(financialEntries.deletedAt)));
}
