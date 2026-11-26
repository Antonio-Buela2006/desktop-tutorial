/**
 * Testes negativos de isolamento multi-tenant (§8.3, §15.2):
 * uma empresa não consegue ler nem alterar dados de outra, mesmo manipulando IDs.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Client, getApp, signupCompany } from "./helpers.js";

let A: Awaited<ReturnType<typeof signupCompany>>;
let B: Awaited<ReturnType<typeof signupCompany>>;
let customerB: string;
let productB: string;
let employeeB: string;

beforeAll(async () => {
  A = await signupCompany();
  B = await signupCompany();
  customerB = (await B.client.post("/api/crm/customers", { name: "Segredo de B" })).body.id;
  productB = (await B.client.post("/api/inventory/products", { sku: "B-1", name: "Produto de B", unitPrice: 100, initialStock: 5 })).body.id;
  employeeB = (await B.client.post("/api/company/employees", { fullName: "Funcionário de B" })).body.id;
});

describe("isolamento horizontal entre empresas", () => {
  it("listagens só devolvem dados do próprio tenant", async () => {
    const r = await A.client.get("/api/crm/customers?pageSize=100");
    expect(r.status).toBe(200);
    expect(r.body.items.map((c: any) => c.name)).not.toContain("Segredo de B");
  });

  it("não é possível ler/alterar/eliminar um registo de outro tenant por ID (404 genérico)", async () => {
    expect((await A.client.put(`/api/crm/customers/${customerB}`, { name: "hack" })).status).toBe(404);
    expect((await A.client.del(`/api/crm/customers/${customerB}`)).status).toBe(404);
    expect((await A.client.post(`/api/inventory/products/${productB}/adjust`, { delta: -5, reason: "roubo" })).status).toBe(404);
    expect((await A.client.put(`/api/company/employees/${employeeB}`, { fullName: "hack" })).status).toBe(404);
    expect((await A.client.post(`/api/company/employees/${employeeB}/offboard`, { exitDate: "2026-01-01" })).status).toBe(404);
    const still = await B.client.get("/api/crm/customers?pageSize=100");
    expect(still.body.items.map((c: any) => c.name)).toContain("Segredo de B");
  });

  it("não é possível vender produtos de outro tenant", async () => {
    const r = await A.client.post("/api/sales/orders", { lines: [{ productId: productB, quantity: 1 }] });
    expect(r.status).toBe(400);
  });

  it("tenant_id enviado pelo cliente é ignorado", async () => {
    const r = await A.client.post("/api/crm/customers", { name: "Injetado", tenantId: B.tenantId });
    expect(r.status).toBe(200);
    expect(r.body.tenantId).toBe(A.tenantId);
    const listB = await B.client.get("/api/crm/customers?pageSize=100");
    expect(listB.body.items.map((c: any) => c.name)).not.toContain("Injetado");
  });

  it("pesquisa global e exportação não atravessam tenants", async () => {
    const s = await A.client.get("/api/search?q=Segredo");
    expect(s.body.results).toHaveLength(0);
    const e = await A.client.post("/api/exports", { scope: "crm", format: "json" });
    expect(e.status).toBe(200);
    const file = await A.client.get(e.body.downloadUrl);
    expect(JSON.stringify(file.body)).not.toContain("Segredo de B");
    // Link de exportação de A não funciona para B
    expect((await B.client.get(e.body.downloadUrl)).status).toBe(404);
  });

  it("faturas e auditoria de outro tenant são inacessíveis", async () => {
    const paid = await signupCompany({ mode: "paid" });
    expect((await A.client.get(`/api/billing/invoices/${paid.invoiceId}`)).status).toBe(404);
    const audit = await A.client.get("/api/audit?pageSize=100");
    expect(audit.body.items.every((e: any) => e.tenantId === A.tenantId)).toBe(true);
  });

  it("sem sessão, a API recusa acesso", async () => {
    const anon = new Client(await getApp());
    expect((await anon.get("/api/crm/customers")).status).toBe(401);
  });

  it("pedidos de escrita sem cabeçalho anti-CSRF são rejeitados", async () => {
    const r = await A.client.req("POST", "/api/crm/customers", { name: "x" }, { "x-nexora-csrf": "0" });
    expect(r.status).toBe(403);
  });
});
