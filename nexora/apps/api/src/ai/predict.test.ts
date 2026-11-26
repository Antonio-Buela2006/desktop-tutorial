import { describe, expect, it } from "vitest";
import { linearForecast, simulatePriceChange } from "./predict.js";

describe("previsões explicáveis", () => {
  it("exige histórico mínimo", () => {
    const f = linearForecast([{ period: "a", value: 1 }], 2, ["x", "y"]);
    expect(f.sufficientData).toBe(false);
    expect(f.predictions).toHaveLength(0);
  });
  it("tendência linear com intervalo e pressupostos", () => {
    const hist = [100, 120, 140, 160, 180].map((v, i) => ({ period: `m${i}`, value: v }));
    const f = linearForecast(hist, 2, ["m5", "m6"]);
    expect(f.predictions[0].value).toBe(200);
    expect(f.predictions[0].low).toBeLessThanOrEqual(200);
    expect(f.predictions[0].high).toBeGreaterThanOrEqual(200);
    expect(f.assumptions.length).toBeGreaterThan(0);
    expect(f.limitations.length).toBeGreaterThan(0);
    expect(f.confidenceLevel).toBe(0.8);
  });
  it("simulação de preço indica pressupostos", () => {
    const s = simulatePriceChange({ revenue: 1000, cost: 600 }, 10, 0, -1);
    expect(s.scenario.revenue).toBe(990);
    expect(s.assumptions[0]).toMatch(/Elasticidade/);
  });
});
