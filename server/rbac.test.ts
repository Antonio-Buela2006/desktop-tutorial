import { describe, expect, it } from "vitest";
import { assertPermission, can } from "./rbac";

describe("RBAC empresarial NEXORA", () => {
  it("dá controlo completo ao administrador e limita operações sensíveis aos papéis autorizados", () => {
    expect(can("administrador", "settings.manage")).toBe(true);
    expect(can("gestor", "finance.manage")).toBe(false);
    expect(can("comercial", "sales.manage")).toBe(true);
    expect(can("funcionario", "audit.view")).toBe(false);
  });

  it("bloqueia a permissão de auditoria para um funcionário", () => {
    expect(() => assertPermission("funcionario", "audit.view")).toThrow("Não tem permissão");
  });
});
