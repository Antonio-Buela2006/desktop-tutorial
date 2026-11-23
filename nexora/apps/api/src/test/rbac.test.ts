/** RBAC aplicado no servidor, limites independentes, saída de funcionários e módulos não contratados. */
import { beforeAll, describe, expect, it } from "vitest";
import { addMember, signupCompany } from "./helpers.js";
import { db } from "../db/client.js";
import { tenantModules } from "../db/schema.js";
import { and, eq } from "drizzle-orm";

describe("permissões validadas no servidor", () => {
  let admin: Awaited<ReturnType<typeof signupCompany>>;
  beforeAll(async () => {
    admin = await signupCompany({ plan: "professional" });
  });

  it("vendedor não consegue operações fora das suas permissões, mesmo chamando a API diretamente", async () => {
    const seller = await addMember(admin.client, ["vendedor"]);
    expect((await seller.client.get("/api/crm/customers")).status).toBe(200);
    expect((await seller.client.post("/api/crm/customers", { name: "Novo" })).status).toBe(200);
    expect((await seller.client.get("/api/finance/transactions")).status).toBe(403);
    expect((await seller.client.post("/api/finance/transactions", { kind: "expense", category: "X", amount: 10, occurredOn: "2026-11-01" })).status).toBe(403);
    expect((await seller.client.post("/api/inventory/products", { sku: "S1", name: "x", unitPrice: 1 })).status).toBe(403);
    expect((await seller.client.get("/api/audit")).status).toBe(403);
    expect((await seller.client.post("/api/company/users/invite", { email: "x@y.invalid", name: "XX" })).status).toBe(403);
    expect((await seller.client.post("/api/billing/cancel", { confirm: true })).status).toBe(403);
  });

  it("acesso a um módulo não implica todas as operações (crm.view sem crm.delete)", async () => {
    const seller = await addMember(admin.client, ["vendedor"]);
    const c = await admin.client.post("/api/crm/customers", { name: "Protegido" });
    expect((await seller.client.del(`/api/crm/customers/${c.body.id}`)).status).toBe(403);
  });

  it("salários só visíveis com permissão específica", async () => {
    await admin.client.post("/api/company/employees", { fullName: "Com Salário", salary: 1000 });
    const hr = await addMember(admin.client, ["funcionario"]);
    // sem employees.view
    expect((await hr.client.get("/api/company/employees")).status).toBe(403);
    const accountant = await addMember(admin.client, ["diretor_geral"]);
    const list = await accountant.client.get("/api/company/employees?pageSize=100");
    expect(list.status).toBe(200);
    expect(list.body.items.find((e: any) => e.fullName === "Com Salário").salary).toBeUndefined();
    const full = await admin.client.get("/api/company/employees?pageSize=100");
    expect(full.body.items.find((e: any) => e.fullName === "Com Salário").salary).toBe(1000);
  });

  it("acesso temporário: função com validade expirada não concede permissões", async () => {
    const m = await addMember(admin.client, ["funcionario"]);
    const roles = (await admin.client.get("/api/company/roles")).body as any[];
    const fin = roles.find((r) => r.code === "gestor_financeiro");
    const past = new Date(Date.now() - 86400_000).toISOString();
    await admin.client.put(`/api/company/users/${m.membershipId}/access`, { roles: [{ roleId: fin.id, validUntil: past }] });
    expect((await m.client.get("/api/finance/transactions")).status).toBe(403);
    const future = new Date(Date.now() + 86400_000).toISOString();
    await admin.client.put(`/api/company/users/${m.membershipId}/access`, { roles: [{ roleId: fin.id, validUntil: future }] });
    expect((await m.client.get("/api/finance/transactions")).status).toBe(200);
  });

  it("ajuste por utilizador: deny sobrepõe-se à função", async () => {
    const m = await addMember(admin.client, ["comercial"]);
    const roles = (await admin.client.get("/api/company/roles")).body as any[];
    const com = roles.find((r) => r.code === "comercial");
    await admin.client.put(`/api/company/users/${m.membershipId}/access`, { roles: [{ roleId: com.id }], overrides: [{ permission: "crm.create", effect: "deny" }] });
    expect((await m.client.post("/api/crm/customers", { name: "Negado" })).status).toBe(403);
  });

  it("administrador secundário não pode conceder permissões fora do seu âmbito nem gerir outros administradores", async () => {
    const sec = await addMember(admin.client, ["administrador"], "secondary_admin");
    const roles = (await sec.client.get("/api/company/roles")).body as any[];
    const fin = roles.find((r) => r.code === "gestor_financeiro");
    const res = await sec.client.post("/api/company/users/invite", { email: "z@z.invalid", name: "ZZ", roleIds: [fin.id] });
    expect(res.status).toBe(403);
    const sec2 = await sec.client.post("/api/company/users/invite", { email: "w@z.invalid", name: "WW", level: "secondary_admin" });
    expect(sec2.status).toBe(403);
  });

  it("segregação de funções: quem regista uma despesa elevada não a aprova", async () => {
    const r = await admin.client.post("/api/finance/transactions", { kind: "expense", category: "Equipamento", amount: 900000, occurredOn: "2026-11-02" });
    expect(r.body.status).toBe("pending_approval");
    expect((await admin.client.post(`/api/finance/transactions/${r.body.id}/decision`, { decision: "approve" })).status).toBe(403);
    const mgr = await addMember(admin.client, ["gestor_financeiro"]);
    expect((await mgr.client.post(`/api/finance/transactions/${r.body.id}/decision`, { decision: "approve" })).status).toBe(200);
  });
});

describe("módulos contratados", () => {
  it("empresa não consegue usar módulos que não contratou", async () => {
    const t = await signupCompany();
    await db.update(tenantModules).set({ status: "inactive" }).where(and(eq(tenantModules.tenantId, t.tenantId), eq(tenantModules.moduleCode, "finance")));
    const r = await t.client.get("/api/finance/transactions");
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("MODULE_NOT_CONTRACTED");
    // Dados preservados: reativar devolve acesso
    await db.update(tenantModules).set({ status: "active" }).where(and(eq(tenantModules.tenantId, t.tenantId), eq(tenantModules.moduleCode, "finance")));
    expect((await t.client.get("/api/finance/transactions")).status).toBe(200);
  });
});

describe("limites independentes e saída de funcionários", () => {
  it("limite de utilizadores bloqueia novas contas sem afetar as existentes; saída liberta a vaga", async () => {
    const t = await signupCompany({ plan: "starter" }); // starter (teste): 3 utilizadores, 10 funcionários
    const u1 = await addMember(t.client, ["vendedor"]);
    const emp = await t.client.post("/api/company/employees", { fullName: "Pessoa Com Conta" });
    // associa a conta ao funcionário
    const { memberships } = await import("../db/schema.js");
    await db.update(memberships).set({ employeeId: emp.body.id }).where(eq(memberships.id, u1.membershipId));
    await addMember(t.client, ["vendedor"]);
    const blocked = await t.client.post("/api/company/users/invite", { email: "extra@x.invalid", name: "Extra" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("LIMIT_REACHED");
    // conta existente continua a funcionar
    expect((await u1.client.get("/api/crm/customers")).status).toBe(200);
    // funcionários sem conta continuam a poder ser registados (limite independente)
    expect((await t.client.post("/api/company/employees", { fullName: "Sem Conta" })).status).toBe(200);
    // saída do funcionário: revoga acesso imediatamente e liberta a vaga
    const off = await t.client.post(`/api/company/employees/${emp.body.id}/offboard`, { exitDate: "2026-11-20" });
    expect(off.body.accountDisabled).toBe(true);
    expect((await u1.client.get("/api/crm/customers")).status).toBe(401);
    expect((await t.client.post("/api/company/users/invite", { email: "extra2@x.invalid", name: "Extra2" })).status).toBe(200);
    // histórico preservado
    const audit = await t.client.get("/api/audit?q=employee.offboarded");
    expect(audit.body.total).toBeGreaterThan(0);
  });

  it("limite de funcionários é aplicado separadamente", async () => {
    const t = await signupCompany({ plan: "starter" });
    // trial já tem 6 funcionários fictícios; limite starter de teste = 10
    for (let i = 0; i < 4; i++) expect((await t.client.post("/api/company/employees", { fullName: `F${i}` })).status).toBe(200);
    const r = await t.client.post("/api/company/employees", { fullName: "Excedente" });
    expect(r.status).toBe(409);
    expect(r.body.error.details.kind).toBe("employees");
  });
});
