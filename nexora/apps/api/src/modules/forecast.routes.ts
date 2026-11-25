/**
 * Previsões fora do assistente (estatística determinística, sem consumo de créditos de IA):
 * rutura de stock e tesouraria. As mesmas funções servem as ferramentas da IA.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authorize, requireCtx } from "../core/context.js";
import { parse } from "../core/http.js";
import { cashflowData, stockCoverData } from "../ai/tools.js";

export async function forecastRoutes(app: FastifyInstance) {
  app.get("/api/inventory/stock-forecast", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "inventory.view");
    const { days } = parse(z.object({ days: z.coerce.number().int().min(14).max(365).default(90) }), req.query);
    return stockCoverData(ctx, days);
  });

  app.get("/api/finance/cashflow-forecast", async (req) => {
    const ctx = requireCtx(req);
    authorize(ctx, "finance.view");
    const { months } = parse(z.object({ months: z.coerce.number().int().min(1).max(6).default(3) }), req.query);
    return cashflowData(ctx, 12, months);
  });
}
