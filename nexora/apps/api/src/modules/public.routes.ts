import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, rlsEnabled } from "../db/client.js";
import { moduleCatalog, plans } from "../db/schema.js";

/** Conteúdo comercial público — administrável pelo portal Nexora. Valores não confirmados não são publicados. */
export async function publicRoutes(app: FastifyInstance) {
  app.get("/api/public/plans", async () => {
    const rows = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(plans.sortOrder);
    return rows.map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      currency: p.currency,
      commercialConfirmed: p.commercialConfirmed,
      // Enquanto não confirmados, preço e limites são publicados como "a definir".
      priceMonthly: p.commercialConfirmed ? p.priceMonthly : null,
      priceYearly: p.commercialConfirmed ? p.priceYearly : null,
      maxEmployees: p.commercialConfirmed ? p.maxEmployees : null,
      maxUsers: p.commercialConfirmed ? p.maxUsers : null,
      includedModules: p.commercialConfirmed ? p.includedModules : null,
      aiCreditsMonthly: p.commercialConfirmed ? p.aiCreditsMonthly : null,
      // Valores de sandbox (apenas para testar o fluxo de compra fora de produção)
      sandbox: process.env.NODE_ENV !== "production" ? { priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, maxEmployees: p.maxEmployees, maxUsers: p.maxUsers, includedModules: p.includedModules, extraUserPrice: p.extraUserPrice, extraModulePrice: p.extraModulePrice } : null,
    }));
  });

  app.get("/api/public/modules", async () => {
    const rows = await db.select().from(moduleCatalog).orderBy(moduleCatalog.sortOrder);
    return rows.map((m) => ({ code: m.code, name: m.name, description: m.description, status: m.status, provisional: m.provisional, dependsOn: m.dependsOn, available: m.status === "active" }));
  });

  app.get("/api/health", async () => {
    await db.execute("select 1" as any);
    return { ok: true, rls: rlsEnabled(), time: new Date().toISOString() };
  });
}
