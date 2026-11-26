/** Importação CSV com pré-visualização, retenção de dados e incidentes. */
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { addMember, Client, getApp, signupCompany } from "./helpers.js";
import { db } from "../db/client.js";
import { customers, employees, financeTransactions, memberships, subscriptions, tenants } from "../db/schema.js";
import { parseCsv } from "../modules/import.routes.js";
import { retentionReview } from "../jobs/jobs.js";
import { DAY } from "../core/subscription.js";

async function adminClient() {
  const c = new Client(await getApp());
  const r = await c.post("/api/admin/auth/login", { email: "admin@nexora.local", password: process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? "ChangeMe!2026" });
  expect(r.status).toBe(200);
  return c;
}

describe("importação CSV", () => {
  it("parser suporta aspas, aspas duplicadas, ';' e BOM", () => {
    expect(parseCsv('﻿nome;email\n"Silva; Lda";a@b.co\n"Diz ""olá""";\n')).toEqual([["nome", "email"], ["Silva; Lda", "a@b.co"], ['Diz "olá"', ""]]);
  });

  it("pré-visualiza sem gravar e importa apenas as linhas válidas", async () => {
    const t = await signupCompany();
    const csv = "SKU,Nome,Preço,Stock\nIMP-1,Produto Importado,1500,10\nIMP-2,X,abc,1\nIMP-1,Duplicado,10,1\nSKU-001,Já existe,10,1\nIMP-3,\"Produto, com vírgula\",\"2,5\",0\n";
    const pv = await t.client.post("/api/import/products/preview", { csv });
    expect(pv.status).toBe(200);
    expect(pv.body).toMatchObject({ total: 5, valid: 2, errors: 1, duplicates: 2 });
    expect(pv.body.rows[1].errors.join(" ")).toMatch(/name|Preço/);
    // nada foi gravado na pré-visualização
    expect((await t.client.get("/api/inventory/products?q=IMP-")).body.total).toBe(0);
    const cm = await t.client.post("/api/import/products/commit", { csv });
    expect(cm.body).toEqual({ created: 2, skipped: 3 });
    const list = await t.client.get("/api/inventory/products?q=IMP-&pageSize=100");
    expect(list.body.items.map((p: any) => p.sku).sort()).toEqual(["IMP-1", "IMP-3"]);
    expect(list.body.items.find((p: any) => p.sku === "IMP-3").unitPrice).toBe(2.5);
    expect((await t.client.get("/api/audit?q=import.products")).body.total).toBe(1);
  });

  it("valida cabeçalhos, permissões e isolamento", async () => {
    const t = await signupCompany({ plan: "professional" });
    expect((await t.client.post("/api/import/customers/preview", { csv: "foo,bar\n1,2\n" })).status).toBe(400);
    const seller = await addMember(t.client, ["funcionario"]);
    expect((await seller.client.post("/api/import/customers/preview", { csv: "nome\nAna\n" })).status).toBe(403);
    const other = await signupCompany();
    await t.client.post("/api/import/customers/commit", { csv: "Nome;NIF;E-mail\nCliente CSV;500000001;csv@x.invalid\nSem Email;500000002;\n" });
    expect((await t.client.get("/api/crm/customers?q=CSV")).body.total).toBe(1);
    expect((await other.client.get("/api/crm/customers?q=CSV")).body.total).toBe(0);
    // NIF duplicado com registo existente é assinalado
    const again = await t.client.post("/api/import/customers/preview", { csv: "nome,nif\nOutro,500000001\n" });
    expect(again.body.duplicates).toBe(1);
  });
});

describe("retenção de dados", () => {
  it("limpa automaticamente os dados fictícios de demonstrações expiradas após o prazo", async () => {
    const t = await signupCompany();
    await db.update(subscriptions).set({ trialEndsAt: new Date(Date.now() - 40 * DAY) }).where(eq(subscriptions.tenantId, t.tenantId));
    await retentionReview();
    const [row] = await db.select().from(tenants).where(eq(tenants.id, t.tenantId));
    expect(row.settings.dataPurgedAt).toBeTruthy();
    expect((await db.select().from(customers).where(eq(customers.tenantId, t.tenantId))).length).toBe(0);
  });

  it("eliminação de empresa cancelada exige prazo cumprido, confirmação, ausência de retenção legal; conserva registos financeiros", async () => {
    const t = await signupCompany();
    const [tn] = await db.select().from(tenants).where(eq(tenants.id, t.tenantId));
    await db.update(tenants).set({ isDemo: false }).where(eq(tenants.id, t.tenantId));
    await db.update(subscriptions).set({ status: "canceled", updatedAt: new Date(Date.now() - 10 * DAY) }).where(eq(subscriptions.tenantId, t.tenantId));
    const admin = await adminClient();
    const list = await admin.get("/api/admin/retention");
    expect(list.body.find((r: any) => r.tenantId === t.tenantId).due).toBe(false);
    expect((await admin.post(`/api/admin/retention/${t.tenantId}/purge`, { confirmName: tn.name, reason: "Fim do prazo de retenção" })).status).toBe(409);
    await db.update(subscriptions).set({ updatedAt: new Date(Date.now() - 100 * DAY) }).where(eq(subscriptions.tenantId, t.tenantId));
    expect((await admin.post(`/api/admin/retention/${t.tenantId}/purge`, { confirmName: "nome errado", reason: "Fim do prazo de retenção" })).status).toBe(400);
    await db.update(tenants).set({ settings: { ...tn.settings, legalHold: true } }).where(eq(tenants.id, t.tenantId));
    expect((await admin.post(`/api/admin/retention/${t.tenantId}/purge`, { confirmName: tn.name, reason: "Fim do prazo de retenção" })).status).toBe(409);
    await db.update(tenants).set({ settings: { ...tn.settings, legalHold: false } }).where(eq(tenants.id, t.tenantId));
    const finBefore = (await db.select().from(financeTransactions).where(eq(financeTransactions.tenantId, t.tenantId))).length;
    expect((await admin.post(`/api/admin/retention/${t.tenantId}/purge`, { confirmName: tn.name, reason: "Fim do prazo de retenção" })).status).toBe(200);
    const cs = await db.select().from(customers).where(eq(customers.tenantId, t.tenantId));
    expect(cs.every((c) => c.name === "Cliente anonimizado" && c.email === null)).toBe(true);
    const es = await db.select().from(employees).where(eq(employees.tenantId, t.tenantId));
    expect(es.every((e) => e.fullName === "Funcionário anonimizado")).toBe(true);
    expect((await db.select().from(financeTransactions).where(eq(financeTransactions.tenantId, t.tenantId))).length).toBe(finBefore);
    const ms = await db.select().from(memberships).where(eq(memberships.tenantId, t.tenantId));
    expect(ms.every((m) => m.status === "disabled")).toBe(true);
    expect((await t.client.get("/api/auth/me")).status).toBe(401);
  });
});

describe("incidentes", () => {
  it("abre, atualiza e notifica apenas as empresas afetadas", async () => {
    const A = await signupCompany();
    const B = await signupCompany();
    const admin = await adminClient();
    const inc = await admin.post("/api/admin/incidents", { title: "Lentidão nas exportações", severity: "high", description: "A investigar atrasos.", affectedTenants: [A.tenantId] });
    expect(inc.status).toBe(200);
    expect((await A.client.get("/api/incidents/active")).body).toHaveLength(1);
    expect((await B.client.get("/api/incidents/active")).body).toHaveLength(0);
    const nA = await A.client.get("/api/notifications");
    expect(nA.body.items.some((n: any) => n.type === "incident.update")).toBe(true);
    // incidentes não podem ser silenciados pelo utilizador
    await A.client.put("/api/notifications/preferences", { emailEnabled: false, mutedTypes: [], quietStartHour: null, quietEndHour: null });
    await admin.post(`/api/admin/incidents/${inc.body.id}/updates`, { status: "resolved", note: "Corrigido." });
    expect((await A.client.get("/api/incidents/active")).body).toHaveLength(0);
    expect((await admin.post(`/api/admin/incidents/${inc.body.id}/updates`, { status: "monitoring", note: "x x x" })).status).toBe(400);
    // empresas não acedem a rotas do portal
    expect((await A.client.get("/api/admin/incidents")).status).toBe(401);
  });
});
