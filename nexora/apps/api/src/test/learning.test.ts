/** Aprendizagem contextual (spec 9.6): consentimento, permissões, isolamento e transparência. */
import { describe, expect, it } from "vitest";
import { addMember, signupCompany } from "./helpers.js";

async function setLearning(c: any, on: boolean) {
  const p = (await c.get("/api/ai/policy")).body;
  const { tenantId: _t, updatedAt: _u, ...rest } = p;
  const r = await c.put("/api/ai/policy", { ...rest, learningEnabled: on });
  expect(r.status).toBe(200);
}

describe("aprendizagem contextual", () => {
  it("desligada por omissão: a IA não usa o histórico e explica como ativar", async () => {
    const t = await signupCompany({ plan: "professional", modules: ["crm", "inventory", "sales", "finance"] });
    expect((await t.client.get("/api/ai/context-profile")).body).toEqual({ enabled: false });
    const chat = await t.client.post("/api/ai/chat", { message: "Dá-me recomendações para o negócio" });
    expect(chat.body.answer).toContain("aprendizagem contextual");
    expect(chat.body.toolCalls).toEqual([]);
    expect((await t.client.post("/api/ai/tools/company_profile", {})).status).toBe(403);
  });

  it("ligada: recomendações a partir do histórico da própria empresa, com transparência", async () => {
    const t = await signupCompany({ plan: "professional", modules: ["crm", "inventory", "sales", "finance"] });
    await setLearning(t.client, true);
    const view = (await t.client.get("/api/ai/context-profile")).body;
    expect(view.enabled).toBe(true);
    expect(view.profile.sales.orders).toBeGreaterThan(0); // dados fictícios da demonstração
    expect(view.profile.privacy).toContain("não são guardados");
    const chat = await t.client.post("/api/ai/chat", { message: "Dá-me recomendações para o negócio" });
    expect(chat.body.toolCalls.map((c: any) => c.tool)).toEqual(["company_profile"]);
    expect(chat.body.answer).toContain("histórico da sua empresa");
    // só nomes de produtos desta empresa
    const names = (await t.client.get("/api/inventory/products?pageSize=100")).body.items.map((p: any) => p.name);
    for (const p of view.profile.sales.topProducts) expect(names).toContain(p.name);
    // desligar volta a impedir o uso
    await setLearning(t.client, false);
    expect((await t.client.get("/api/ai/context-profile")).body.enabled).toBe(false);
  });

  it("respeita as permissões de quem pergunta e não revela dados pessoais", async () => {
    const t = await signupCompany({ plan: "professional", modules: ["crm", "inventory", "sales", "finance"] });
    await setLearning(t.client, true);
    const seller = await addMember(t.client, ["vendedor"]);
    const r = await seller.client.post("/api/ai/tools/company_profile", {});
    expect(r.status).toBe(200);
    expect(r.body.sales).toBeDefined();
    expect(r.body.finance).toBeUndefined(); // o vendedor não vê finanças
    // sem nomes nem contactos de clientes, só contagens e quotas
    const json = JSON.stringify(r.body);
    const custs = (await t.client.get("/api/crm/customers?pageSize=100")).body.items;
    for (const c of custs) {
      expect(json).not.toContain(c.name);
      if (c.email) expect(json).not.toContain(c.email);
    }
    // a página de transparência é só para quem configura a IA
    expect((await seller.client.get("/api/ai/context-profile")).status).toBe(403);
  });
});
