import { describe, expect, it } from "vitest";
import { toCsv } from "./reports";

describe("exportação CSV NEXORA", () => {
  it("escapa vírgulas, aspas e valores ausentes para compatibilidade com Excel", () => {
    expect(toCsv(["Nome", "Nota"], [["Ana, Lda.", 'Disse "ok"'], ["Sem valor", null]])).toBe('"Nome";"Nota"\r\n"Ana, Lda.";"Disse ""ok"""\r\n"Sem valor";""');
  });
});
