/** Ciclo de subscrição: registo pago → pagamento sandbox (webhook assinado) → ativação; atraso; cancelamento. */
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { Client, getApp, signupCompany } from "./helpers.js";
import { db } from "../db/client.js";
import { invoices, subscriptions } from "../db/schema.js";
import { hmacSha256 } from "../core/crypto.js";
import { config } from "../config.js";
import { DAY } from "../core/subscription.js";

async function paySandbox(c: Client, invoiceId: string) {
  const p = await c.post(`/api/billing/invoices/${invoiceId}/pay`, { provider: "sandbox", idempotencyKey: `k-${invoiceId}` });
  expect(p.status).toBe(200);
  const token = new URL("http://x" + p.body.checkoutUrl).searchParams.get("token");
  const done = await c.post(`/api/payments/sandbox/${token}/complete`, { outcome: "succeeded" });
  expect(done.body.delivered).toBe(true);
  return p.body;
}

describe("registo pago e ativação automática", () => {
  it("fica pendente até ao pagamento e ativa automaticamente após confirmação", async () => {
    const t = await signupCompany({ mode: "paid", plan: "starter", modules: ["crm", "inventory", "sales"] });
    const me = await t.client.get("/api/auth/me");
    expect(me.body.subscription.state).toBe("pending_payment");
    expect((await t.client.get("/api/crm/customers")).status).toBe(403);
    // franquia de 2 módulos (teste) ⇒ o 3.º é adicional na fatura
    const inv = await t.client.get(`/api/billing/invoices/${t.invoiceId}`);
    expect(inv.body.invoice.lines.some((l: any) => /adicional/i.test(l.description))).toBe(true);
    await paySandbox(t.client, t.invoiceId!);
    const after = await t.client.get("/api/auth/me");
    expect(after.body.subscription.state).toBe("active");
    expect((await t.client.get("/api/crm/customers")).status).toBe(200);
  });

  it("pedido de pagamento repetido é idempotente", async () => {
    const t = await signupCompany({ mode: "paid" });
    const a = await t.client.post(`/api/billing/invoices/${t.invoiceId}/pay`, { provider: "sandbox", idempotencyKey: "same-key-1" });
    const b = await t.client.post(`/api/billing/invoices/${t.invoiceId}/pay`, { provider: "sandbox", idempotencyKey: "same-key-1" });
    expect(a.body.paymentId).toBe(b.body.paymentId);
  });

  it("webhook com assinatura inválida é rejeitado e eventos duplicados não reprocessam", async () => {
    const app = await getApp();
    const t = await signupCompany({ mode: "paid" });
    const p = await t.client.post(`/api/billing/invoices/${t.invoiceId}/pay`, { provider: "sandbox", idempotencyKey: "wh-key-0001" });
    const pay = (await t.client.get(`/api/billing/invoices/${t.invoiceId}`)).body.payments[0];
    const raw = JSON.stringify({ id: "evt_dup_1", type: "payment.succeeded", data: { providerRef: pay.providerRef, amount: pay.amount } });
    const bad = await app.inject({ method: "POST", url: "/api/webhooks/payments/sandbox", headers: { "content-type": "application/json", "x-nexora-signature": "bad" }, payload: raw });
    expect(bad.statusCode).toBe(401);
    const sig = hmacSha256(config.paymentWebhookSecret, raw);
    const ok1 = await app.inject({ method: "POST", url: "/api/webhooks/payments/sandbox", headers: { "content-type": "application/json", "x-nexora-signature": sig }, payload: raw });
    const ok2 = await app.inject({ method: "POST", url: "/api/webhooks/payments/sandbox", headers: { "content-type": "application/json", "x-nexora-signature": sig }, payload: raw });
    expect(ok1.json().result).toBe("invoice_paid");
    expect(ok2.json().duplicate).toBe(true);
    void p;
  });
});

describe("atraso, somente leitura e suspensão", () => {
  it("aplica dias 1–3 / 4–8 / 9+ no servidor e restaura após pagamento", async () => {
    const t = await signupCompany({ mode: "paid" });
    await paySandbox(t.client, t.invoiceId!);
    // fatura de renovação vencida há N dias
    const mk = async (daysAgo: number) => {
      await db.delete(invoices).where(eq(invoices.number, `TST-${t.tenantId}`));
      const [i] = await db.insert(invoices).values({ tenantId: t.tenantId, number: `TST-${t.tenantId}`, kind: "subscription", status: "issued", lines: [], subtotal: 15000, total: 15000, dueAt: new Date(Date.now() - daysAgo * DAY + 60_000) }).returning();
      return i;
    };
    await mk(2);
    expect((await t.client.get("/api/auth/me")).body.subscription.state).toBe("grace");
    expect((await t.client.post("/api/crm/customers", { name: "Em tolerância" })).status).toBe(200);

    await mk(5);
    expect((await t.client.get("/api/auth/me")).body.subscription.state).toBe("read_only");
    expect((await t.client.get("/api/crm/customers")).status).toBe(200);
    const w = await t.client.post("/api/crm/customers", { name: "Bloqueado" });
    expect(w.status).toBe(403);
    expect(w.body.error.code).toBe("SUBSCRIPTION_READ_ONLY");
    expect((await t.client.post("/api/exports", { scope: "crm", format: "csv" })).status).toBe(200);

    const inv = await mk(10);
    expect((await t.client.get("/api/auth/me")).body.subscription.state).toBe("suspended");
    expect((await t.client.get("/api/crm/customers")).status).toBe(403);
    // faturação continua acessível para regularizar
    expect((await t.client.get("/api/billing/overview")).status).toBe(200);
    await paySandbox(t.client, inv.id);
    expect((await t.client.get("/api/auth/me")).body.subscription.state).toBe("active");
    expect((await t.client.get("/api/crm/customers")).status).toBe(200);
  });
});

describe("módulos, plano e cancelamento", () => {
  it("troca de módulos gratuita nos primeiros 7 dias; depois proporcional; dependências verificadas", async () => {
    const t = await signupCompany({ mode: "paid", plan: "professional", modules: ["crm", "inventory", "sales"] });
    await paySandbox(t.client, t.invoiceId!);
    const dep = await t.client.post("/api/billing/modules/preview", { remove: ["inventory"] });
    expect(dep.body.problems[0]).toMatch(/dependência/);
    const free = await t.client.post("/api/billing/modules/preview", { add: ["finance"] });
    expect(free.body.freeSwap).toBe(true);
    expect(free.body.prorated).toBe(0);
    await db.update(subscriptions).set({ moduleSwapWindowEndsAt: new Date(Date.now() - DAY) }).where(eq(subscriptions.tenantId, t.tenantId));
    const paid = await t.client.post("/api/billing/modules/preview", { add: ["finance"] });
    expect(paid.body.freeSwap).toBe(false);
    expect(paid.body.prorated).toBeGreaterThan(0);
    // remover um módulo bloqueia o acesso mas preserva os dados
    await t.client.post("/api/crm/customers", { name: "Fica guardado" });
    const rm = await t.client.post("/api/billing/modules/apply", { remove: ["crm"], confirm: true });
    expect(rm.status).toBe(200);
    expect((await t.client.get("/api/crm/customers")).status).toBe(403);
    await t.client.post("/api/billing/modules/apply", { add: ["crm"], confirm: true });
    const back = await t.client.get("/api/crm/customers?q=Fica");
    expect(back.body.items).toHaveLength(1);
  });

  it("downgrade mostra impacto e não apaga dados", async () => {
    const t = await signupCompany({ mode: "paid", plan: "professional", modules: ["crm"] });
    await paySandbox(t.client, t.invoiceId!);
    for (let i = 0; i < 12; i++) await t.client.post("/api/company/employees", { fullName: `E${i}` });
    const pv = await t.client.post("/api/billing/plan/preview", { planCode: "starter" });
    expect(pv.body.direction).toBe("downgrade");
    expect(pv.body.violations.length).toBeGreaterThan(0);
    expect(pv.body.prorated).toBeLessThan(0);
    await t.client.post("/api/billing/plan/change", { planCode: "starter", confirm: true });
    const list = await t.client.get("/api/company/employees?pageSize=100");
    expect(list.body.total).toBe(12);
    expect((await t.client.post("/api/company/employees", { fullName: "Bloqueado" })).status).toBe(409);
  });

  it("cancelamento mantém acesso até ao fim do período pago", async () => {
    const t = await signupCompany({ mode: "paid" });
    await paySandbox(t.client, t.invoiceId!);
    const c = await t.client.post("/api/billing/cancel", { confirm: true });
    expect(c.status).toBe(200);
    expect((await t.client.get("/api/auth/me")).body.subscription.state).toBe("cancel_scheduled");
    expect((await t.client.get("/api/crm/customers")).status).toBe(200);
    await db.update(subscriptions).set({ currentPeriodEnd: new Date(Date.now() - 1000) }).where(eq(subscriptions.tenantId, t.tenantId));
    expect((await t.client.get("/api/auth/me")).body.subscription.state).toBe("canceled");
    expect((await t.client.get("/api/crm/customers")).status).toBe(403);
    // exportação dos próprios dados continua possível após cancelamento
    expect((await t.client.post("/api/exports", { scope: "crm", format: "csv" })).status).toBe(200);
  });

  it("conversão do trial para pago ativa após pagamento", async () => {
    const t = await signupCompany({ mode: "trial" });
    const conv = await t.client.post("/api/billing/convert", { planCode: "starter", modules: ["crm"], purgeDemoData: true });
    expect(conv.status).toBe(200);
    await paySandbox(t.client, conv.body.invoice.id);
    const me = await t.client.get("/api/auth/me");
    expect(me.body.subscription.state).toBe("active");
    expect(me.body.modules).toEqual(["crm"]);
    expect(me.body.tenant.isDemo).toBe(false);
    expect((await t.client.get("/api/crm/customers")).body.total).toBe(0);
  });
});
