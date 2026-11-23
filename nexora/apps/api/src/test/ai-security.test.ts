/** IA: permissões herdadas, aprovação humana, segregação, idempotência, créditos; 2FA; auditoria encadeada. */
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { generate } from "otplib";
import { addMember, Client, getApp, signupCompany } from "./helpers.js";
import { db } from "../db/client.js";
import { aiWallets, auditEvents, tenants } from "../db/schema.js";

describe("IA segura", () => {
  it("a IA herda as permissões do utilizador (não revela dados sem permissão)", async () => {
    const t = await signupCompany({ plan: "professional" });
    const seller = await addMember(t.client, ["vendedor"]);
    const r = await seller.client.post("/api/ai/chat", { message: "Registar despesa de 1000 em Combustível" });
    expect(r.status).toBe(200);
    expect(r.body.answer).toMatch(/Não tem acesso/);
    expect(r.body.toolCalls).toHaveLength(0);
  });

  it("política 'restrita' impede acesso da IA a dados de módulos", async () => {
    const t = await signupCompany();
    const pol = (await t.client.get("/api/ai/policy")).body;
    await t.client.put("/api/ai/policy", { ...pol, accessLevel: "restricted" });
    const r = await t.client.post("/api/ai/chat", { message: "Que produtos têm stock baixo?" });
    expect(r.body.answer).toMatch(/Não tem acesso/);
  });

  it("consulta é automática; ação sensível fica pendente e exige aprovação de outra pessoa (executa uma só vez)", async () => {
    const t = await signupCompany({ plan: "professional" });
    const low = await t.client.post("/api/ai/chat", { message: "Que produtos têm stock baixo?" });
    expect(low.body.toolCalls[0]).toMatchObject({ tool: "list_low_stock", outcome: "executed" });

    const r = await t.client.post("/api/ai/chat", { message: "Ajustar stock do SKU-001: acrescentar 10 unidades" });
    expect(r.body.pendingActions).toHaveLength(1);
    const actionId = r.body.pendingActions[0].id;
    expect(r.body.pendingActions[0].preview).toMatchObject({ antes: 40, depois: 50 });
    // o próprio requerente não pode aprovar
    expect((await t.client.post(`/api/ai/actions/${actionId}/decision`, { decision: "approve" })).status).toBe(403);
    const mgr = await addMember(t.client, ["gestor_stock"]);
    const ok = await mgr.client.post(`/api/ai/actions/${actionId}/decision`, { decision: "approve" });
    expect(ok.body.status).toBe("executed");
    const again = await mgr.client.post(`/api/ai/actions/${actionId}/decision`, { decision: "approve" });
    expect(again.status).toBe(409);
    const prods = await t.client.get("/api/inventory/products?q=SKU-001");
    expect(prods.body.items[0].stockQty).toBe(50);
    const audit = await t.client.get("/api/audit?actorType=ai&pageSize=50");
    expect(audit.body.items.map((e: any) => e.action)).toEqual(expect.arrayContaining(["ai.action_proposed", "ai.action_executed"]));
  });

  it("tarefa simples é executada automaticamente quando a política o permite", async () => {
    const t = await signupCompany();
    const r = await t.client.post("/api/ai/chat", { message: 'Criar cliente "Cliente da IA"' });
    expect(r.body.toolCalls[0].outcome).toBe("executed_auto");
    const pol = (await t.client.get("/api/ai/policy")).body;
    await t.client.put("/api/ai/policy", { ...pol, autonomy: "suggest_only" });
    const r2 = await t.client.post("/api/ai/chat", { message: 'Criar cliente "Outro Cliente"' });
    expect(r2.body.toolCalls[0].outcome).toBe("pending_approval");
  });

  it("créditos esgotados bloqueiam só a IA, não os módulos", async () => {
    const t = await signupCompany();
    await db.update(aiWallets).set({ balance: 0 }).where(eq(aiWallets.tenantId, t.tenantId));
    const r = await t.client.post("/api/ai/chat", { message: "resumo" });
    expect(r.status).toBe(402);
    expect(r.body.error.code).toBe("AI_CREDITS_EXHAUSTED");
    expect((await t.client.get("/api/crm/customers")).status).toBe(200);
  });

  it("previsão de vendas apresenta intervalo, pressupostos e limitações", async () => {
    const t = await signupCompany();
    const r = await t.client.post("/api/ai/tools/forecast_sales", { months: 3 });
    expect(r.status).toBe(200);
    expect(r.body.sufficientData).toBe(true);
    expect(r.body.predictions).toHaveLength(3);
    expect(r.body.limitations.length).toBeGreaterThan(0);
  });
});

describe("2FA e sessões", () => {
  it("login com 2FA exige código; sessões podem ser terminadas remotamente", async () => {
    const app = await getApp();
    const t = await signupCompany();
    const setup = await t.client.post("/api/auth/2fa/setup");
    const code = await generate({ secret: setup.body.secret });
    const en = await t.client.post("/api/auth/2fa/enable", { code });
    expect(en.body.recoveryCodes).toHaveLength(10);

    const other = new Client(app);
    await other.post("/api/auth/login", { email: t.email, password: "SenhaForte123" });
    const blocked = await other.get("/api/crm/customers");
    expect(blocked.status).toBe(401);
    expect(blocked.body.error.code).toBe("MFA_REQUIRED");
    expect((await other.post("/api/auth/2fa/verify", { code: "000000" })).status).toBe(401);
    expect((await other.post("/api/auth/2fa/verify", { code: en.body.recoveryCodes[0] })).status).toBe(200);
    expect((await other.get("/api/crm/customers")).status).toBe(200);
    // código de recuperação é de utilização única
    const third = new Client(app);
    await third.post("/api/auth/login", { email: t.email, password: "SenhaForte123" });
    expect((await third.post("/api/auth/2fa/verify", { code: en.body.recoveryCodes[0] })).status).toBe(401);

    const sessions = await t.client.get("/api/auth/sessions");
    for (const s of sessions.body.filter((x: any) => !x.current)) expect((await t.client.del(`/api/auth/sessions/${s.id}`)).status).toBe(200);
    expect((await other.get("/api/crm/customers")).status).toBe(401);
  });

  it("política da empresa pode exigir 2FA a administradores", async () => {
    const t = await signupCompany();
    const [row] = await db.select().from(tenants).where(eq(tenants.id, t.tenantId));
    await db.update(tenants).set({ settings: { ...row.settings, require2fa: "admins" } }).where(eq(tenants.id, t.tenantId));
    const r = await t.client.get("/api/crm/customers");
    expect(r.body.error.code).toBe("MFA_ENROLLMENT_REQUIRED");
  });

  it("bloqueio temporário após tentativas falhadas", async () => {
    const app = await getApp();
    const t = await signupCompany();
    const c = new Client(app);
    for (let i = 0; i < 5; i++) await c.post("/api/auth/login", { email: t.email, password: "errada" });
    const r = await c.post("/api/auth/login", { email: t.email, password: "SenhaForte123" });
    expect(r.status).toBe(429);
  });
});

describe("auditoria protegida contra alteração", () => {
  it("cadeia de hashes deteta alterações indevidas", async () => {
    const t = await signupCompany();
    await t.client.post("/api/crm/customers", { name: "Auditado" });
    expect((await t.client.get("/api/audit/verify")).body.intact).toBe(true);
    const [ev] = await db.select().from(auditEvents).where(eq(auditEvents.tenantId, t.tenantId)).limit(1);
    await db.update(auditEvents).set({ summary: "adulterado" }).where(eq(auditEvents.id, ev.id));
    const v = await t.client.get("/api/audit/verify");
    expect(v.body.intact).toBe(false);
    expect(v.body.firstInconsistentId).toBe(ev.id);
  });
});
