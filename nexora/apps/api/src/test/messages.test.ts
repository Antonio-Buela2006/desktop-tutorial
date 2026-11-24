/** Mensagens do servidor em PT/EN: catálogo completo e notificações no idioma de quem as lê. */
import { describe, expect, it } from "vitest";
import { MESSAGE_KEYS, m, render } from "../core/messages.js";
import { addMember, signupCompany } from "./helpers.js";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort();

describe("catálogo de mensagens", () => {
  it("cada mensagem existe em PT e EN com os mesmos parâmetros", () => {
    for (const k of MESSAGE_KEYS) {
      const pt = render(m(k), "pt");
      const en = render(m(k), "en");
      expect(pt.length, k).toBeGreaterThan(0);
      expect(en.length, k).toBeGreaterThan(0);
      expect(placeholders(en), k).toEqual(placeholders(pt));
    }
  });

  it("substitui parâmetros, incluindo mensagens aninhadas", () => {
    const msg = m("incident.update.title", { title: "BD lenta", status: m("incident.status.resolved") });
    expect(render(msg, "pt")).toBe("Incidente: BD lenta — Resolvido");
    expect(render(msg, "en")).toBe("Incident: BD lenta — Resolved");
    expect(() => m("nao.existe")).toThrow();
  });
});

describe("notificações localizadas", () => {
  it("a mesma notificação aparece no idioma de cada leitor e acompanha a mudança de idioma", async () => {
    const t = await signupCompany({ plan: "professional" });
    const lda = (await t.client.post("/api/company/branches", { code: "LDA", name: "Luanda" })).body.id;
    const prod = (await t.client.post("/api/inventory/products", { sku: "I18N-1", name: "Produto", unitPrice: 10, initialStock: 5 })).body.id;
    const en = await addMember(t.client, ["gestor_stock"]);
    const pt = await addMember(t.client, ["gestor_stock"]);
    expect((await en.client.req("PATCH", "/api/auth/me", { locale: "en" })).status).toBe(200);
    const o = await t.client.post("/api/inventory/transfer-orders", { fromBranchId: null, toBranchId: lda, lines: [{ productId: prod, quantity: 1 }], reason: "Reposição" });
    const find = async (c: typeof en.client) => (await c.get("/api/notifications")).body.items.find((n: any) => n.type === "inventory.transfer_request");
    const nEn = await find(en.client);
    expect(nEn.title).toBe(`Transfer order ${o.body.number} awaits approval`);
    expect(nEn.body).toBe("Reposição"); // conteúdo do utilizador não é traduzido
    expect(nEn.i18n).toBeUndefined();
    expect((await find(pt.client)).title).toBe(`Guia de transferência ${o.body.number} aguarda aprovação`);
    await en.client.req("PATCH", "/api/auth/me", { locale: "pt" });
    expect((await find(en.client)).title).toBe(`Guia de transferência ${o.body.number} aguarda aprovação`);
  });
});

describe("migração de notificações antigas", () => {
  it("as chaves usadas na migração existem no catálogo", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../../drizzle");
    const file = fs.readdirSync(dir).find((f) => f.includes("notification_i18n_backfill"))!;
    const keys = [...fs.readFileSync(path.join(dir, file), "utf8").matchAll(/'([a-z_]+(?:\.[a-z_]+)+\.(?:title|investigating|identified|monitoring|resolved))'/g)].map((x) => x[1]);
    expect(keys.length).toBeGreaterThan(10);
    for (const k of keys) expect(MESSAGE_KEYS, k).toContain(k);
  });
});
