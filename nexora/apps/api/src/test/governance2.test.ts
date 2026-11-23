/** Preferências de notificação, alertas configuráveis, unidades, anonimização, antivírus e onboarding. */
import net from "node:net";
import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { addMember, getApp, signupCompany } from "./helpers.js";
import { db } from "../db/client.js";
import { notifications, products } from "../db/schema.js";
import { inQuietHours, notifyByPermission } from "../core/notify.js";
import { runAlerts } from "../jobs/jobs.js";

describe("preferências de notificação e alertas", () => {
  it("horário de silêncio atravessa a meia-noite (hora de Angola)", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 0, 1, (h + 23) % 24, 0)); // UTC+1
    expect(inQuietHours({ quietStartHour: 22, quietEndHour: 7 }, at(23))).toBe(true);
    expect(inQuietHours({ quietStartHour: 22, quietEndHour: 7 }, at(3))).toBe(true);
    expect(inQuietHours({ quietStartHour: 22, quietEndHour: 7 }, at(12))).toBe(false);
    expect(inQuietHours({ quietStartHour: null, quietEndHour: null }, at(3))).toBe(false);
  });

  it("utilizador pode silenciar alertas, mas não notificações de segurança/faturação", async () => {
    const t = await signupCompany();
    const me = (await t.client.get("/api/auth/me")).body;
    const r = await t.client.put("/api/notifications/preferences", { emailEnabled: false, mutedTypes: ["ai.alert.low_stock"], quietStartHour: 22, quietEndHour: 7 });
    expect(r.status).toBe(200);
    expect((await t.client.put("/api/notifications/preferences", { emailEnabled: true, mutedTypes: ["security.new_device"], quietStartHour: null, quietEndHour: null })).status).toBe(400);
    await notifyByPermission(t.tenantId, "inventory.view", { type: "ai.alert.low_stock", title: "silenciado", dedupeKey: "x1" });
    await notifyByPermission(t.tenantId, "billing.view", { type: "billing.grace", title: "obrigatório", dedupeKey: "x2" });
    const rows = await db.select().from(notifications).where(eq(notifications.membershipId, me.membership.id));
    expect(rows.map((n) => n.title)).toContain("obrigatório");
    expect(rows.map((n) => n.title)).not.toContain("silenciado");
  });

  it("alertas respeitam a configuração da empresa e não se repetem no mesmo dia", async () => {
    const t = await signupCompany();
    const count = async () => (await db.select().from(notifications).where(and(eq(notifications.tenantId, t.tenantId), eq(notifications.type, "ai.alert.low_stock")))).length;
    const cfg = (await t.client.get("/api/company/alerts")).body;
    await t.client.put("/api/company/alerts", { ...cfg, lowStock: false });
    await runAlerts();
    expect(await count()).toBe(0);
    await t.client.put("/api/company/alerts", { ...cfg, lowStock: true });
    await runAlerts();
    await runAlerts();
    expect(await count()).toBe(1); // 1 administrador, sem duplicados
    expect((await t.client.put("/api/company/alerts", { ...cfg, abnormalExpenseMultiplier: 0.5 })).status).toBe(400);
  });
});

describe("unidades e anonimização", () => {
  it("funcionários associados a unidades do próprio tenant", async () => {
    const A = await signupCompany();
    const B = await signupCompany();
    const br = await A.client.post("/api/company/branches", { code: "LDA", name: "Luanda Sede" });
    expect(br.status).toBe(200);
    expect((await A.client.post("/api/company/branches", { code: "LDA", name: "Dup" })).status).toBe(409);
    expect((await A.client.post("/api/company/employees", { fullName: "Na Sede", branchId: br.body.id })).status).toBe(200);
    // outra empresa não pode usar a unidade de A
    expect((await B.client.post("/api/company/employees", { fullName: "Intruso", branchId: br.body.id })).status).toBe(400);
    const list = await A.client.get(`/api/company/employees?branchId=${br.body.id}`);
    expect(list.body.items.map((e: any) => e.fullName)).toEqual(["Na Sede"]);
    const branches = await A.client.get("/api/company/branches");
    expect(branches.body[0].employees).toBe(1);
    expect((await B.client.get("/api/company/branches")).body).toHaveLength(0);
  });

  it("anonimiza ex-funcionários, preservando o histórico; bloqueado sob retenção legal", async () => {
    const t = await signupCompany();
    const e = (await t.client.post("/api/company/employees", { fullName: "Pessoa Real", email: "pessoa@x.invalid" })).body;
    expect((await t.client.post(`/api/company/employees/${e.id}/anonymize`, { confirm: true })).status).toBe(400); // ainda ativo
    await t.client.post(`/api/company/employees/${e.id}/offboard`, { exitDate: "2026-10-01" });
    await t.client.put("/api/company/legal-hold", { enabled: true, reason: "Processo judicial em curso" });
    expect((await t.client.post(`/api/company/employees/${e.id}/anonymize`, { confirm: true })).status).toBe(409);
    await t.client.put("/api/company/legal-hold", { enabled: false, reason: "Processo encerrado" });
    expect((await t.client.post(`/api/company/employees/${e.id}/anonymize`, { confirm: true })).status).toBe(200);
    const list = await t.client.get("/api/company/employees?status=exited&pageSize=100");
    const row = list.body.items.find((x: any) => x.id === e.id);
    expect(row.fullName).toMatch(/^Ex-funcionário #/);
    expect(row.email).toBeNull();
    expect(row.exitDate).toBe("2026-10-01");
  });

  it("só o administrador principal altera a retenção legal", async () => {
    const t = await signupCompany({ plan: "professional" });
    const sec = await addMember(t.client, ["administrador"], "secondary_admin");
    expect((await sec.client.put("/api/company/legal-hold", { enabled: true, reason: "tentativa" })).status).toBe(403);
  });
});

describe("antivírus e onboarding", () => {
  let server: net.Server;
  afterAll(() => { delete process.env.CLAMAV_HOST; server?.close(); });

  it("bloqueia ficheiros infetados e falha fechada se o antivírus estiver indisponível", async () => {
    // clamd simulado: deteta a assinatura EICAR
    server = net.createServer((sock) => {
      const chunks: Buffer[] = [];
      sock.on("data", (d) => {
        chunks.push(Buffer.from(d));
        const all = Buffer.concat(chunks);
        if (all.subarray(all.length - 4).equals(Buffer.alloc(4))) sock.end(all.includes(Buffer.from("EICAR")) ? "stream: Eicar-Test-Signature FOUND\0" : "stream: OK\0");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    process.env.CLAMAV_HOST = "127.0.0.1";
    process.env.CLAMAV_PORT = String((server.address() as net.AddressInfo).port);
    const t = await signupCompany();
    const emp = (await t.client.post("/api/company/employees", { fullName: "Com Ficheiro" })).body.id;
    const app = await getApp();
    const send = async (content: string) => {
      const b = "----av" + Date.now();
      const payload = Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${b}--\r\n`);
      return app.inject({ method: "POST", url: `/api/files/employee/${emp}`, payload, headers: { "content-type": `multipart/form-data; boundary=${b}`, "x-nexora-csrf": "1", cookie: t.client.cookie } });
    };
    expect((await send("ficheiro limpo")).statusCode).toBe(200);
    const bad = await send("X5O!P%@AP EICAR-STANDARD-ANTIVIRUS-TEST-FILE");
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.code).toBe("FILE_INFECTED");
    process.env.CLAMAV_PORT = "1"; // indisponível
    expect((await send("qualquer")).statusCode).toBe(503);
  });

  it("guia de primeiros passos reflete o progresso", async () => {
    const t = await signupCompany();
    const r = await t.client.get("/api/company/onboarding");
    expect(r.body.steps.find((s: any) => s.key === "employees").done).toBe(true); // demo já tem funcionários
    expect(r.body.steps.find((s: any) => s.key === "mfa").done).toBe(false);
    await db.update(products).set({ stockQty: 0 }).where(eq(products.tenantId, t.tenantId));
  });
});
