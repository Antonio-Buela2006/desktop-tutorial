import { describe, expect, it } from "vitest";
import { buildWillyRecommendations } from "./willy";

describe("regras explicáveis do WILLY", () => {
  it("gera alertas críticos de stock, pagamentos vencidos e margem negativa com referências estáveis", () => {
    const recommendations = buildWillyRecommendations(
      [{ inventoryId: 9, quantity: 0, minimumQuantity: 5, productName: "Cabo de rede", sku: "CAB-09" }],
      [{ type: "despesa", status: "pendente", dueDate: new Date("2026-08-01"), amount: "250.00" }],
      0,
      new Date("2026-08-20")
    );
    expect(recommendations.map(item => item.referenceKey)).toEqual(expect.arrayContaining(["stock-9", "financeiro-vencidos", "financeiro-margem-negativa", "comercial-sem-vendas"]));
    expect(recommendations.find(item => item.referenceKey === "stock-9")).toMatchObject({ severity: "critico", confidence: 98 });
    expect(recommendations.find(item => item.referenceKey === "financeiro-vencidos")?.rationale).toContain("250.00");
  });

  it("não cria anomalias quando o contexto não contém sinais de risco", () => {
    expect(buildWillyRecommendations([{ inventoryId: 1, quantity: 12, minimumQuantity: 4, productName: "Papel", sku: "PAP-01" }], [{ type: "receita", status: "pago", dueDate: null, amount: "500.00" }], 2)).toEqual([]);
  });
});
