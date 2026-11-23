/**
 * Seeds de plataforma (idempotentes) — dados fictícios apenas.
 * Valores comerciais (preços/limites) são VALORES DE TESTE para sandbox,
 * marcados commercial_confirmed=false: o site público mostra "a definir".
 */
import { eq } from "drizzle-orm";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db, sql } from "./client.js";
import { moduleCatalog, plans, platformAdmins, platformSettings } from "./schema.js";
import { hashPassword } from "../core/crypto.js";

export const TEST_PLANS = [
  { code: "starter", name: "Starter", description: "Para pequenas equipas que começam a organizar a gestão.", sortOrder: 1,
    priceMonthly: 15000, priceYearly: 150000, maxEmployees: 10, maxUsers: 3, maxSecondaryAdmins: 1, includedModules: 2, aiCreditsMonthly: 200 },
  { code: "professional", name: "Professional", description: "Para PME em crescimento com vários departamentos.", sortOrder: 2,
    priceMonthly: 45000, priceYearly: 450000, maxEmployees: 50, maxUsers: 15, maxSecondaryAdmins: 3, includedModules: 3, aiCreditsMonthly: 1000 },
  { code: "enterprise", name: "Enterprise", description: "Para empresas com operações e equipas alargadas.", sortOrder: 3,
    priceMonthly: 120000, priceYearly: 1200000, maxEmployees: 500, maxUsers: 100, maxSecondaryAdmins: 10, includedModules: 4, aiCreditsMonthly: 5000 },
];

export const CATALOG = [
  { code: "crm", name: "Clientes (CRM)", description: "Cadastro de clientes, contactos e histórico comercial.", status: "active", implemented: true,
    dependsOn: [], navPath: "/app/customers", sortOrder: 1, permissions: ["crm.view", "crm.create", "crm.edit", "crm.delete", "crm.export"] },
  { code: "inventory", name: "Stock e Inventário", description: "Produtos, níveis de stock, ajustes e alertas de rutura.", status: "active", implemented: true,
    dependsOn: [], navPath: "/app/products", sortOrder: 2, permissions: ["inventory.view", "inventory.create", "inventory.edit", "inventory.delete", "inventory.adjust", "inventory.export"] },
  { code: "sales", name: "Vendas", description: "Registo de vendas com baixa automática de stock.", status: "active", implemented: true,
    dependsOn: ["inventory"], navPath: "/app/sales", sortOrder: 3, permissions: ["sales.view", "sales.create", "sales.cancel", "sales.export"] },
  { code: "finance", name: "Finanças", description: "Receitas, despesas, aprovações e tesouraria.", status: "active", implemented: true,
    dependsOn: [], navPath: "/app/finance", sortOrder: 4, permissions: ["finance.view", "finance.create", "finance.edit", "finance.delete", "finance.approve", "finance.export"] },
  ...Array.from({ length: 14 }, (_, i) => {
    const n = String(i + 5).padStart(2, "0");
    return { code: `module_${n}`, name: `Módulo ${n} — por definir`, description: "Área de gestão prevista; nome e âmbito aguardam validação do proprietário do produto.",
      status: "pending", implemented: false, dependsOn: [] as string[], navPath: null, sortOrder: i + 5, permissions: [] as string[] };
  }),
];

export const DEFAULT_PLATFORM_SETTINGS: Record<string, unknown> = {
  ai_costs: { chat: 1, tool_read: 1, tool_write: 2, forecast: 3, simulation: 3 },
  ai_credit_packs: [{ code: "pack_500", credits: 500, price: 5000 }, { code: "pack_2000", credits: 2000, price: 18000 }],
  retention: { postCancelDays: 90, trashDays: 30, trialSuspendedDays: 30 },
  tax: { defaultRate: 0, note: "PENDENTE: validar IVA e formato fiscal com contabilista local." },
  payment_providers: { sandbox: true, bank_transfer: true, multicaixa_express: false },
};

export async function seedPlatform() {
  for (const p of TEST_PLANS) {
    const [exists] = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, p.code));
    if (!exists) await db.insert(plans).values({ ...p, extraUserPrice: 2500, extraModulePrice: 7500, commercialConfirmed: false });
  }
  for (const m of CATALOG) {
    await db.insert(moduleCatalog).values({ ...m, provisional: true }).onConflictDoNothing();
  }
  for (const [key, value] of Object.entries(DEFAULT_PLATFORM_SETTINGS)) {
    await db.insert(platformSettings).values({ key, value }).onConflictDoNothing();
  }
  const email = (process.env.SEED_PLATFORM_ADMIN_EMAIL ?? "admin@nexora.local").toLowerCase();
  const [admin] = await db.select({ id: platformAdmins.id }).from(platformAdmins).where(eq(platformAdmins.email, email));
  if (!admin) {
    await db.insert(platformAdmins).values({
      email,
      name: "Administrador Nexora",
      role: "owner",
      passwordHash: await hashPassword(process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? "ChangeMe!2026"),
    });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { seedShowcaseTenant } = await import("../core/demoData.js");
  seedPlatform()
    .then(() => seedShowcaseTenant())
    .then(() => console.log("Seed concluído."))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => sql.end());
}
