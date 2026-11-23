import { describe, expect, it } from "vitest";
import { capabilitiesFor, computeAccessState, daysOverdue, dependents, effectiveLimits, isWithinFreeSwapWindow, limitViolations, missingDependencies, overdueState, prorate, DAY } from "./subscription.js";

const base = { status: "active", trialEndsAt: null, currentPeriodEnd: new Date("2026-12-31"), cancelAtPeriodEnd: false };

describe("regras de atraso de pagamento (§6.1)", () => {
  const due = new Date("2026-11-01T00:00:00Z");
  const at = (d: number) => new Date(due.getTime() + (d - 1) * DAY + 3600_000);
  it("dias 1–3: tolerância com acesso normal", () => {
    for (const d of [1, 2, 3]) {
      expect(daysOverdue(due, at(d))).toBe(d);
      expect(computeAccessState(base, due, at(d))).toBe("grace");
      expect(capabilitiesFor("grace").write).toBe(true);
    }
  });
  it("dias 4–8: somente leitura (consulta e exportação)", () => {
    for (const d of [4, 6, 8]) expect(computeAccessState(base, due, at(d))).toBe("read_only");
    expect(capabilitiesFor("read_only")).toEqual({ read: true, write: false, export: true, billing: true });
  });
  it("a partir do dia 9: suspensão com dados preservados", () => {
    for (const d of [9, 30]) expect(computeAccessState(base, due, at(d))).toBe("suspended");
    expect(capabilitiesFor("suspended")).toMatchObject({ read: false, write: false, billing: true });
  });
  it("sem atraso antes do vencimento", () => {
    expect(daysOverdue(due, new Date(due.getTime() - 1000))).toBe(0);
    expect(overdueState(0)).toBe("ok");
  });
});

describe("estados da subscrição", () => {
  const now = new Date("2026-11-20");
  it("trial ativo e expirado", () => {
    expect(computeAccessState({ ...base, status: "trial", trialEndsAt: new Date("2026-11-25") }, null, now)).toBe("trial");
    expect(computeAccessState({ ...base, status: "trial", trialEndsAt: new Date("2026-11-10") }, null, now)).toBe("trial_expired");
  });
  it("cancelamento mantém acesso até ao fim do período pago", () => {
    expect(computeAccessState({ ...base, cancelAtPeriodEnd: true }, null, now)).toBe("cancel_scheduled");
    expect(capabilitiesFor("cancel_scheduled").write).toBe(true);
    expect(computeAccessState({ ...base, cancelAtPeriodEnd: true, currentPeriodEnd: new Date("2026-11-19") }, null, now)).toBe("canceled");
    expect(capabilitiesFor("canceled")).toMatchObject({ read: false, export: true });
  });
});

describe("módulos e limites", () => {
  it("janela de troca gratuita de 7 dias", () => {
    const end = new Date("2026-11-08");
    expect(isWithinFreeSwapWindow(end, new Date("2026-11-07"))).toBe(true);
    expect(isWithinFreeSwapWindow(end, new Date("2026-11-09"))).toBe(false);
    expect(isWithinFreeSwapWindow(null, new Date())).toBe(false);
  });
  it("cálculo proporcional (cobrança e crédito)", () => {
    const s = new Date("2026-11-01"), e = new Date("2026-12-01"), mid = new Date("2026-11-16");
    expect(prorate(3000, s, e, mid)).toBe(1500);
    expect(prorate(-3000, s, e, mid)).toBe(-1500);
    expect(prorate(3000, s, e, new Date("2026-12-05"))).toBe(0);
  });
  it("dependências", () => {
    const cat = new Map([["sales", ["inventory"]], ["inventory", []], ["crm", []]]);
    expect(missingDependencies("sales", new Set(["sales"]), cat)).toEqual(["inventory"]);
    expect(dependents("inventory", new Set(["inventory", "sales"]), cat)).toEqual(["sales"]);
  });
  it("limites de funcionários e utilizadores são independentes", () => {
    const l = effectiveLimits({ maxEmployees: 10, maxUsers: 3, maxSecondaryAdmins: 1, includedModules: 2 }, 2, 5);
    expect(l).toMatchObject({ maxEmployees: 15, maxUsers: 5 });
    expect(limitViolations(l, { employees: 16, users: 2, secondaryAdmins: 0, modules: 1 })).toHaveLength(1);
    expect(limitViolations(l, { employees: 1, users: 6, secondaryAdmins: 0, modules: 1 })[0]).toMatch(/Utilizadores/);
  });
});
