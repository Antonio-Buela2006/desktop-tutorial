/** Previsões de rutura de stock e de tesouraria (spec 9.8): cálculo, endpoints, âmbito e assistente. */
import { describe, expect, it } from "vitest";
import { cashflowForecast, stockCover } from "../ai/predict.js";
import { addMember, signupCompany } from "./helpers.js";
import { db } from "../db/client.js";
import { financeTransactions } from "../db/schema.js";
import { eq } from "drizzle-orm";

describe("cálculos", () => {
  it("dias de cobertura, data de rutura e produtos sem vendas", () => {
    const today = new Date("2026-11-01T00:00:00Z");
    const r = stockCover(
      [
        { sku: "A", name: "A", stockQty: 30, soldQty: 90, reorderLevel: 10 }, // 1/dia → 30 dias
        { sku: "B", name: "B", stockQty: 5, soldQty: 180, reorderLevel: 10 }, // 2/dia → 2 dias, já abaixo da reposição
        { sku: "C", name: "C", stockQty: 50, soldQty: 0, reorderLevel: 5 },
      ],
      90,
      today,
    );
    expect(r.items.map((i) => i.sku)).toEqual(["B", "A", "C"]);
    expect(r.items[0]).toMatchObject({ daysOfCover: 2, stockoutDate: "2026-11-03", reorderInDays: 0, avgDaily: 2 });
    expect(r.items[1]).toMatchObject({ daysOfCover: 30, reorderInDays: 20 });
    expect(r.items[2].daysOfCover).toBeNull();
    expect(r.atRisk).toBe(1);
    expect(r.withoutSales).toBe(1);
    expect(r.limitations.length).toBeGreaterThan(0);
  });

  it("tesouraria: saldo = receitas − despesas, intervalo conservador e histórico insuficiente", () => {
    const h = (vals: number[]) => vals.map((v, i) => ({ period: `2026-0${i + 1}`, value: v }));
    const f = cashflowForecast(h([100, 110, 120, 130]), h([80, 80, 80, 80]), 2, ["2026-05", "2026-06"]);
    expect(f.sufficientData).toBe(true);
    expect(f.net[0]).toMatchObject({ period: "2026-05", value: f.income[0].value - f.expense[0].value });
    expect(f.net[0].low).toBe(f.income[0].low - f.expense[0].high);
    expect(f.net[0].high).toBe(f.income[0].high - f.expense[0].low);
    expect(f.income[0].value).toBe(140);
    expect(cashflowForecast(h([1, 2]), h([1, 2]), 2, []).sufficientData).toBe(false);
  });
});

describe("endpoints e assistente", () => {
  it("rutura de stock a partir das vendas reais, com âmbito por unidade", async () => {
    const t = await signupCompany({ plan: "professional" });
    const lda = (await t.client.post("/api/company/branches", { code: "LDA", name: "Luanda" })).body.id;
    const p = (await t.client.post("/api/inventory/products", { sku: "FC-1", name: "Prev", unitPrice: 10, initialStock: 100, reorderLevel: 5 })).body.id;
    await t.client.post("/api/inventory/transfers", { productId: p, fromBranchId: null, toBranchId: lda, quantity: 40, reason: "Abastecer" });
    for (let i = 0; i < 3; i++) expect((await t.client.post("/api/sales/orders", { branchId: lda, lines: [{ productId: p, quantity: 3 }] })).status).toBe(200);
    const r = await t.client.get("/api/inventory/stock-forecast");
    expect(r.status).toBe(200);
    const item = r.body.items.find((x: any) => x.sku === "FC-1");
    expect(item).toMatchObject({ stockQty: 91, soldQty: 9, avgDaily: 0.1, daysOfCover: 910 });
    // utilizador restrito a Luanda só vê o stock de Luanda (40 − 9 = 31)
    const u = await addMember(t.client, ["gestor_stock"]);
    await t.client.put(`/api/company/users/${u.membershipId}/branches`, { branchIds: [lda] });
    const scoped = (await u.client.get("/api/inventory/stock-forecast")).body.items.find((x: any) => x.sku === "FC-1");
    expect(scoped).toMatchObject({ stockQty: 31, soldQty: 9, daysOfCover: 310 });
    // sem permissão de stock
    const seller = await addMember(t.client, ["funcionario"]);
    expect((await seller.client.get("/api/inventory/stock-forecast")).status).toBe(403);
  });

  it("tesouraria a partir dos movimentos aprovados dos meses completos", async () => {
    const t = await signupCompany({ plan: "professional" });
    // a demonstração traz movimentos fictícios: começa-se de uma base vazia
    await db.delete(financeTransactions).where(eq(financeTransactions.tenantId, t.tenantId));
    expect((await t.client.get("/api/finance/cashflow-forecast")).body.sufficientData).toBe(false);
    const now = new Date();
    const day = (back: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 10)).toISOString().slice(0, 10);
    const rows = [4, 3, 2, 1].flatMap((back, i) => [
      { tenantId: t.tenantId, kind: "income", category: "Vendas", amount: String(1000 + i * 100), occurredOn: day(back), status: "approved" },
      { tenantId: t.tenantId, kind: "expense", category: "Renda", amount: "600", occurredOn: day(back), status: "approved" },
      // pendentes não contam
      { tenantId: t.tenantId, kind: "expense", category: "Pendente", amount: "99999", occurredOn: day(back), status: "pending_approval" },
    ]);
    await db.insert(financeTransactions).values(rows as any);
    const r = await t.client.get("/api/finance/cashflow-forecast?months=2");
    expect(r.body.sufficientData).toBe(true);
    expect(r.body.history.map((h: any) => h.expense)).toEqual([600, 600, 600, 600]);
    expect(r.body.income[0].value).toBe(1400);
    expect(r.body.net[0].value).toBe(800);
    expect(r.body.net).toHaveLength(2);
    // o assistente responde com a previsão de tesouraria
    const chat = await t.client.post("/api/ai/chat", { message: "Previsão de tesouraria" });
    expect(chat.body.answer).toContain("Previsão de tesouraria");
    expect(chat.body.toolCalls.map((c: any) => c.tool)).toEqual(["forecast_cashflow"]);
    const stock = await t.client.post("/api/ai/chat", { message: "Previsão de rutura de stock" });
    expect(stock.body.toolCalls.map((c: any) => c.tool)).toEqual(["forecast_stock"]);
  });
});
