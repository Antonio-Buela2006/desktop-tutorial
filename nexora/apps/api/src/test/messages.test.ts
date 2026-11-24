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

describe("documentos e ações da IA no idioma do leitor", () => {
  it("a guia de transporte em PDF segue o idioma de quem a descarrega", async () => {
    const { getApp } = await import("./helpers.js");
    const zlib = await import("node:zlib");
    const t = await signupCompany({ plan: "professional" });
    const lda = (await t.client.post("/api/company/branches", { code: "LDA", name: "Luanda" })).body.id;
    const prod = (await t.client.post("/api/inventory/products", { sku: "DOC-1", name: "Produto", unitPrice: 10, initialStock: 5 })).body.id;
    const o = (await t.client.post("/api/inventory/transfer-orders", { fromBranchId: null, toBranchId: lda, lines: [{ productId: prod, quantity: 1 }], reason: "Teste" })).body;
    const app = await getApp();
    // texto das páginas do PDF (streams comprimidos com deflate)
    const text = async () => {
      const raw = (await app.inject({ method: "GET", url: `/api/inventory/transfer-orders/${o.id}/guide`, headers: { cookie: t.client.cookie } })).rawPayload;
      const out: string[] = [];
      const s = raw.toString("latin1");
      for (const mt of s.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
        try {
          out.push(zlib.inflateSync(Buffer.from(mt[1], "latin1")).toString("latin1"));
        } catch {}
      }
      // cada operador TJ tem o texto em grupos hexadecimais (separados por ajustes de kerning)
      return out
        .join("\n")
        .split("\n")
        .filter((l) => l.endsWith("TJ"))
        .map((l) => [...l.matchAll(/<([0-9a-fA-F]+)>/g)].map((h) => Buffer.from(h[1], "hex").toString("latin1")).join(""))
        .join("\n");
    };
    expect(await text()).toContain("Guia de transporte");
    await t.client.req("PATCH", "/api/auth/me", { locale: "en" });
    const en = await text();
    expect(en).toContain("Delivery note");
    expect(en).toContain("Central warehouse");
  });

  it("a pré-visualização de ações antigas (chaves em português) é apresentada no idioma pedido", async () => {
    const { describePreview } = await import("../core/messages.js");
    const legacy = { acao: "Ajustar stock", produto: "SKU-1 · Arroz", antes: 8, depois: 28, motivo: "Reposição" };
    const en = describePreview(legacy, "adjust_stock", "en");
    expect(en.title).toBe("Adjust stock");
    expect(en.rows).toEqual([
      { label: "Product", value: "SKU-1 · Arroz" },
      { label: "Before", value: "8" },
      { label: "After", value: "28" },
      { label: "Reason", value: "Reposição" },
    ]);
    const nw = describePreview({ action: m("ai.action.record_expense"), amount: 500, impact: m("ai.impact.record_expense") }, "record_expense", "pt");
    expect(nw).toEqual({ title: "Registar despesa", rows: [{ label: "Valor", value: "500" }], impact: "Afeta o resultado financeiro do período." });
  });
});
