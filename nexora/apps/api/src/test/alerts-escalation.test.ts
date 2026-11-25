/** Alertas (spec 9.5): escalonamento de alertas não lidos e destinatários por função. */
import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { notifications } from "../db/schema.js";
import { notifyByPermission } from "../core/notify.js";
import { m } from "../core/messages.js";
import { escalateUnreadAlerts } from "../jobs/jobs.js";
import { addMember, signupCompany } from "./helpers.js";

const HOUR = 3_600_000;
const alert = (key: string) => ({ type: "ai.alert.low_stock", severity: "warning" as const, title: m("ai.alert.low_stock.title", { count: 2 }), body: "Arroz (1)", link: "/app/products?lowStock=1", dedupeKey: key });
const age = (tenantId: string, key: string, hours: number) =>
  db.update(notifications).set({ createdAt: new Date(Date.now() - hours * HOUR) }).where(and(eq(notifications.tenantId, tenantId), eq(notifications.dedupeKey, key)));
const escalated = async (c: any) => (await c.get("/api/notifications")).body.items.filter((n: any) => n.type === "ai.alert.escalated");

describe("escalonamento de alertas", () => {
  it("um alerta sem leitura sobe aos administradores uma só vez", async () => {
    const t = await signupCompany();
    const stock = await addMember(t.client, ["gestor_stock"]);
    await notifyByPermission(t.tenantId, "inventory.view", alert("low-stock:esc-1"), { roleCodes: ["gestor_stock"] });
    // ainda dentro do prazo: nada sobe
    expect(await escalateUnreadAlerts(t.tenantId, 24)).toBe(0);
    await age(t.tenantId, "low-stock:esc-1", 25);
    expect(await escalateUnreadAlerts(t.tenantId, 24)).toBeGreaterThan(0);
    expect(await escalateUnreadAlerts(t.tenantId, 24)).toBe(0); // não repete
    const [e] = await escalated(t.client);
    expect(e).toMatchObject({ severity: "critical", title: "Alerta sem leitura há mais de 24 h", body: "2 produto(s) com stock baixo", link: "/app/products?lowStock=1" });
    // o gestor de stock (sem permissão de configurar a empresa) não recebe o escalonamento
    expect(await escalated(stock.client)).toHaveLength(0);
  });

  it("não sobe se alguém o leu, nem com o escalonamento desligado", async () => {
    const t = await signupCompany();
    const stock = await addMember(t.client, ["gestor_stock"]);
    await notifyByPermission(t.tenantId, "inventory.view", alert("low-stock:esc-2"), { roleCodes: ["gestor_stock"] });
    await age(t.tenantId, "low-stock:esc-2", 30);
    const mine = (await stock.client.get("/api/notifications")).body.items.find((n: any) => n.type === "ai.alert.low_stock");
    await stock.client.post("/api/notifications/read", { ids: [mine.id] });
    expect(await escalateUnreadAlerts(t.tenantId, 24)).toBe(0);
    await notifyByPermission(t.tenantId, "inventory.view", alert("low-stock:esc-3"));
    await age(t.tenantId, "low-stock:esc-3", 30);
    expect(await escalateUnreadAlerts(t.tenantId, 0)).toBe(0);
  });

  it("destinatários por função: só quem tem essa função recebe (e com a permissão da área)", async () => {
    const t = await signupCompany();
    const stock = await addMember(t.client, ["gestor_stock"]);
    const seller = await addMember(t.client, ["vendedor"]);
    await notifyByPermission(t.tenantId, "inventory.view", alert("low-stock:roles"), { roleCodes: ["gestor_stock", "vendedor"] });
    const has = async (c: any) => (await c.get("/api/notifications")).body.items.some((n: any) => n.dedupeKey === "low-stock:roles");
    expect(await has(stock.client)).toBe(true);
    expect(await has(t.client)).toBe(false); // o administrador principal não tem estas funções
    // o vendedor tem a função escolhida; recebe só se também tiver inventory.view
    const sellerPerms = (await seller.client.get("/api/auth/me")).body.permissions as string[];
    expect(await has(seller.client)).toBe(sellerPerms.includes("inventory.view"));
  });

  it("configuração: horas de escalonamento e funções válidas", async () => {
    const t = await signupCompany();
    const cfg = (await t.client.get("/api/company/alerts")).body;
    expect(cfg).toMatchObject({ escalateAfterHours: 24, recipientRoles: [] });
    expect((await t.client.put("/api/company/alerts", { ...cfg, recipientRoles: ["nao_existe"] })).status).toBe(400);
    expect((await t.client.put("/api/company/alerts", { ...cfg, escalateAfterHours: 8, recipientRoles: ["gestor_stock"] })).status).toBe(200);
    expect((await t.client.get("/api/company/alerts")).body).toMatchObject({ escalateAfterHours: 8, recipientRoles: ["gestor_stock"] });
  });
});
