import { describe, expect, it } from "vitest";
import { buildDoubleEntryLines, calculateSaleTotals } from "./salesMath";

describe("cálculos da venda integrada", () => {
  it("calcula subtotal, IVA de 14% e total a partir das linhas de venda", () => {
    expect(calculateSaleTotals([{ quantity: 2, unitPrice: 100 }, { quantity: 1, unitPrice: 50 }])).toEqual({ subtotal: 250, taxAmount: 35, totalAmount: 285 });
  });

  it("mantém a partida dobrada equilibrada", () => {
    const totals = calculateSaleTotals([{ quantity: 3, unitPrice: 100 }]);
    const lines = buildDoubleEntryLines(totals.totalAmount, totals.subtotal, totals.taxAmount);
    expect(lines.reduce((sum, line) => sum + line.debit, 0)).toBe(lines.reduce((sum, line) => sum + line.credit, 0));
  });
});
