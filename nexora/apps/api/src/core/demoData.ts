/** Dados fictícios para o ambiente de demonstração (trial). Nunca dados reais. */
import { and, eq, inArray } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client.js";
import {
  customers,
  employees,
  financeTransactions,
  memberships,
  membershipRoles,
  products,
  roles,
  salesOrders,
  stockMovements,
  tenants,
  users,
} from "../db/schema.js";
import { hashPassword } from "./crypto.js";
import { createTenant } from "./tenantService.js";

const CUSTOMERS = ["Kianda Comércio", "Mussulo Serviços", "Palanca Distribuição", "Lunda Agro", "Benguela Mar", "Cuanza Tech", "Huíla Têxteis", "Namibe Pescas"];
const PRODUCTS: [string, string, number, number, number, number][] = [
  ["SKU-001", "Arroz 25kg", 18500, 14000, 40, 15],
  ["SKU-002", "Óleo alimentar 5L", 7200, 5400, 8, 12],
  ["SKU-003", "Açúcar 50kg", 32000, 26000, 22, 10],
  ["SKU-004", "Farinha de milho 25kg", 15500, 11800, 5, 10],
  ["SKU-005", "Feijão 10kg", 12800, 9500, 60, 20],
  ["SKU-006", "Água 1,5L (pack 6)", 1900, 1200, 150, 50],
  ["SKU-007", "Sabão em barra (cx)", 9800, 7100, 18, 8],
  ["SKU-008", "Leite em pó 2,5kg", 21000, 16500, 3, 6],
];
const EMPLOYEES: [string, string, string, number][] = [
  ["Ana Fictícia", "Diretora-geral", "Direção", 950000],
  ["Bruno Exemplo", "Gestor financeiro", "Finanças", 620000],
  ["Carla Teste", "Gestora de stock", "Logística", 480000],
  ["David Demo", "Vendedor", "Comercial", 310000],
  ["Eva Amostra", "Técnica de RH", "Recursos Humanos", 420000],
  ["Filipe Simulado", "Motorista", "Logística", 210000],
];

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

export async function seedDemoData(tenantId: string, tx: DbOrTx = db) {
  const rand = rng(42);
  const now = new Date();
  const cust = await tx.insert(customers).values(CUSTOMERS.map((name, i) => ({ tenantId, name, email: `contacto${i + 1}@exemplo.invalid`, phone: `+244 900 000 ${100 + i}` }))).returning();
  const prods = await tx
    .insert(products)
    .values(PRODUCTS.map(([sku, name, unitPrice, unitCost, stockQty, reorderLevel]) => ({ tenantId, sku, name, unitPrice, unitCost, stockQty, reorderLevel })))
    .returning();
  await tx.insert(employees).values(
    EMPLOYEES.map(([fullName, jobTitle, department, salary], i) => ({
      tenantId, fullName, jobTitle, department, salary, email: `func${i + 1}@exemplo.invalid`, hireDate: `202${i % 5}-0${(i % 9) + 1}-15`,
    })),
  );
  // 6 meses de vendas com tendência ligeiramente crescente (para previsões)
  const orders: (typeof salesOrders.$inferInsert)[] = [];
  let n = 1;
  for (let m = 5; m >= 0; m--) {
    const perMonth = 10 + (5 - m) * 2;
    for (let k = 0; k < perMonth; k++) {
      const p = prods[Math.floor(rand() * prods.length)];
      const qty = 1 + Math.floor(rand() * 4);
      const day = 1 + Math.floor(rand() * 27);
      const soldAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, Math.min(day, m === 0 ? Math.max(1, now.getUTCDate()) : 28)));
      orders.push({
        tenantId,
        number: `V-${String(n++).padStart(5, "0")}`,
        customerId: cust[Math.floor(rand() * cust.length)].id,
        lines: [{ productId: p.id, name: p.name, quantity: qty, unitPrice: p.unitPrice, total: p.unitPrice * qty }],
        total: p.unitPrice * qty,
        soldAt,
      });
    }
  }
  await tx.insert(salesOrders).values(orders);
  const fin: (typeof financeTransactions.$inferInsert)[] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 5)).toISOString().slice(0, 10);
    fin.push({ tenantId, kind: "expense", category: "Salários", description: "Processamento salarial (fictício)", amount: 2990000, occurredOn: d });
    fin.push({ tenantId, kind: "expense", category: "Renda", description: "Renda do armazém", amount: 450000 + (m === 1 ? 600000 : 0), occurredOn: d });
    fin.push({ tenantId, kind: "income", category: "Vendas", description: "Receitas de vendas", amount: 3500000 + (5 - m) * 250000, occurredOn: d });
  }
  await tx.insert(financeTransactions).values(fin);
  await tx.insert(stockMovements).values(prods.map((p) => ({ tenantId, productId: p.id, delta: p.stockQty, reason: "Stock inicial (demonstração)" })));
}

/** Apaga dados de negócio da demonstração (conversão para conta real com dados limpos). */
export async function purgeBusinessData(tenantId: string, tx: DbOrTx) {
  await tx.delete(stockMovements).where(eq(stockMovements.tenantId, tenantId));
  await tx.delete(salesOrders).where(eq(salesOrders.tenantId, tenantId));
  await tx.delete(products).where(eq(products.tenantId, tenantId));
  await tx.delete(customers).where(eq(customers.tenantId, tenantId));
  await tx.delete(financeTransactions).where(eq(financeTransactions.tenantId, tenantId));
  const emps = await tx.select({ id: employees.id }).from(employees).where(eq(employees.tenantId, tenantId));
  if (emps.length) {
    await tx.update(memberships).set({ employeeId: null }).where(and(eq(memberships.tenantId, tenantId), inArray(memberships.employeeId, emps.map((e) => e.id))));
    await tx.delete(employees).where(eq(employees.tenantId, tenantId));
  }
}

export const SHOWCASE = {
  adminEmail: "demo@nexora.local",
  adminPassword: "DemoNexora2026",
  sellerEmail: "vendedor@nexora.local",
  sellerPassword: "VendedorNexora2026",
};

/** Empresa de demonstração para desenvolvimento local (credenciais documentadas no README). */
export async function seedShowcaseTenant() {
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, SHOWCASE.adminEmail));
  if (exists) return;
  const { tenant } = await createTenant({
    company: { name: "Empresa Demo Lda (fictícia)" },
    admin: { name: "Administrador Demo", email: SHOWCASE.adminEmail, password: SHOWCASE.adminPassword },
    planCode: "professional",
    modules: [],
    mode: "trial",
  });
  await db.transaction(async (tx) => {
    // Demo local: 2FA opcional para facilitar a primeira experiência (por omissão as empresas exigem 2FA a administradores).
    await tx.update(tenants).set({ settings: { ...tenant.settings, require2fa: "off" } }).where(eq(tenants.id, tenant.id));
    await seedDemoData(tenant.id, tx);
    const [seller] = await tx.insert(users).values({ email: SHOWCASE.sellerEmail, name: "Vendedor Demo", passwordHash: await hashPassword(SHOWCASE.sellerPassword) }).returning();
    const [m] = await tx.insert(memberships).values({ tenantId: tenant.id, userId: seller.id, level: "member" }).returning();
    const [role] = await tx.select().from(roles).where(and(eq(roles.tenantId, tenant.id), eq(roles.code, "vendedor")));
    await tx.insert(membershipRoles).values({ tenantId: tenant.id, membershipId: m.id, roleId: role.id });
  });
  console.log(`Empresa demo criada: ${SHOWCASE.adminEmail} / ${SHOWCASE.adminPassword}`);
}
