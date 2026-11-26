/** Âmbito por unidade: utilizadores restritos só veem e criam dados das suas unidades. */
import { beforeAll, describe, expect, it } from "vitest";
import { addMember, getApp, signupCompany } from "./helpers.js";

let t: Awaited<ReturnType<typeof signupCompany>>;
let lda: string;
let bgl: string;
let product: string;

beforeAll(async () => {
  t = await signupCompany({ plan: "professional" });
  lda = (await t.client.post("/api/company/branches", { code: "LDA", name: "Luanda" })).body.id;
  bgl = (await t.client.post("/api/company/branches", { code: "BGL", name: "Benguela" })).body.id;
  product = (await t.client.post("/api/inventory/products", { sku: "BR-1", name: "Produto Unidade", unitPrice: 1000, initialStock: 100 })).body.id;
  // Cada unidade vende do seu próprio stock: abastece-se primeiro a partir do armazém central
  for (const b of [lda, bgl]) await t.client.post("/api/inventory/transfers", { productId: product, fromBranchId: null, toBranchId: b, quantity: 40, reason: "Abastecimento" });
  await t.client.post("/api/sales/orders", { branchId: bgl, lines: [{ productId: product, quantity: 1 }] });
  await t.client.post("/api/finance/transactions", { kind: "expense", category: "Renda Benguela", amount: 1000, occurredOn: "2026-11-02", branchId: bgl });
  await t.client.post("/api/company/employees", { fullName: "Trabalhador Benguela", branchId: bgl });
});

async function scopedUser(roles: string[], branchIds: string[]) {
  const m = await addMember(t.client, roles);
  const r = await t.client.put(`/api/company/users/${m.membershipId}/branches`, { branchIds });
  expect(r.status).toBe(200);
  return m;
}

describe("âmbito por unidade", () => {
  it("vendas e finanças de outras unidades ficam invisíveis e inacessíveis", async () => {
    const u = await scopedUser(["diretor_geral"], [lda]);
    const me = await u.client.get("/api/auth/me");
    expect(me.body.membership.branchScope).toEqual([lda]);
    // cria uma venda: sem unidade indicada, assume a única do âmbito
    const sale = await u.client.post("/api/sales/orders", { lines: [{ productId: product, quantity: 1 }] });
    expect(sale.status).toBe(200);
    expect(sale.body.branchId).toBe(lda);
    const list = await u.client.get("/api/sales/orders?pageSize=100");
    expect(list.body.items.every((o: any) => o.branchId === lda)).toBe(true);
    expect((await u.client.get(`/api/sales/orders?branchId=${bgl}`)).status).toBe(403);
    // não pode criar noutra unidade
    expect((await u.client.post("/api/sales/orders", { branchId: bgl, lines: [{ productId: product, quantity: 1 }] })).status).toBe(403);
    // finanças
    const fin = await u.client.get("/api/finance/transactions?pageSize=100");
    expect(fin.body.items.map((x: any) => x.category)).not.toContain("Renda Benguela");
    expect((await u.client.post("/api/finance/transactions", { kind: "expense", category: "Fora", amount: 10, occurredOn: "2026-11-02", branchId: bgl })).status).toBe(403);
  });

  it("dashboard, funcionários, pesquisa, exportação e documentos respeitam o âmbito", async () => {
    const u = await scopedUser(["diretor_geral", "gestor_rh"], [lda]);
    const emps = await u.client.get("/api/company/employees?pageSize=100");
    expect(emps.body.items.map((e: any) => e.fullName)).not.toContain("Trabalhador Benguela");
    const search = await u.client.get("/api/search?q=Benguela");
    expect(search.body.results.filter((r: any) => r.type === "Funcionário")).toHaveLength(0);
    const all = await t.client.get("/api/company/employees?pageSize=100");
    const bglEmp = all.body.items.find((e: any) => e.fullName === "Trabalhador Benguela");
    expect((await u.client.put(`/api/company/employees/${bglEmp.id}`, { fullName: "Tentativa" })).status).toBe(404);
    expect((await u.client.get(`/api/files/employee/${bglEmp.id}`)).status).toBe(404);
    // dashboard: as vendas do administrador (todas as unidades) são maiores que as da unidade
    const dAdmin = await t.client.get("/api/dashboard");
    const dUser = await u.client.get("/api/dashboard");
    expect(dUser.body.sales.month).toBeLessThan(dAdmin.body.sales.month);
    // exportação
    const ex = await u.client.post("/api/exports", { scope: "all", format: "json" });
    const app = await getApp();
    const file = await app.inject({ method: "GET", url: ex.body.downloadUrl, headers: { cookie: u.client.cookie } });
    expect(file.body).not.toContain("Trabalhador Benguela");
    expect(file.body).not.toContain("Renda Benguela");
  });

  it("administradores não são restringidos e o âmbito só se aplica a membros", async () => {
    const sec = await addMember(t.client, ["administrador"], "secondary_admin");
    expect((await t.client.put(`/api/company/users/${sec.membershipId}/branches`, { branchIds: [lda] })).status).toBe(400);
    const d = await t.client.get(`/api/dashboard?branchId=${bgl}`);
    expect(d.status).toBe(200);
  });

  it("não aceita unidades de outra empresa", async () => {
    const other = await signupCompany();
    const foreign = (await other.client.post("/api/company/branches", { code: "X", name: "Alheia" })).body.id;
    const m = await addMember(t.client, ["vendedor"]);
    expect((await t.client.put(`/api/company/users/${m.membershipId}/branches`, { branchIds: [foreign] })).status).toBe(400);
    expect((await t.client.post("/api/sales/orders", { branchId: foreign, lines: [{ productId: product, quantity: 1 }] })).status).toBe(400);
  });
});
