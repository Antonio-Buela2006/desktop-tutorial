/** Acessos suspeitos (spec 10.2): entrada após tentativas falhadas e bloqueio da conta avisam o titular. */
import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { auditEvents, notifications, users } from "../db/schema.js";
import { Client, getApp, signupCompany } from "./helpers.js";

const PW = "SenhaForte123";
async function attempt(email: string, password: string) {
  const c = new Client(await getApp());
  return { c, r: await c.post("/api/auth/login", { email, password }) };
}
const typesFor = async (tenantId: string) => (await db.select({ type: notifications.type }).from(notifications).where(eq(notifications.tenantId, tenantId))).map((n) => n.type);

describe("acessos suspeitos", () => {
  it("entrada certa após 3 tentativas erradas avisa o titular e fica auditada", async () => {
    const t = await signupCompany();
    for (let i = 0; i < 3; i++) expect((await attempt(t.email, "Errada12345")).r.status).toBe(401);
    const { c, r } = await attempt(t.email, PW);
    expect(r.status).toBe(200);
    const n = (await c.get("/api/notifications")).body.items.find((x: any) => x.type === "security.suspicious_login");
    expect(n).toMatchObject({ severity: "warning", title: "Entrada na sua conta após várias tentativas falhadas", link: "/app/security" });
    expect(n.body).toContain("3 tentativa(s)");
    const [u] = await db.select().from(users).where(eq(users.email, t.email));
    const ev = await db.select().from(auditEvents).where(and(eq(auditEvents.action, "security.suspicious_login"), eq(auditEvents.entityId, u.id)));
    expect(ev).toHaveLength(1);
    expect(u.failedLogins).toBe(0);
  });

  it("poucas tentativas erradas não geram aviso", async () => {
    const t = await signupCompany();
    for (let i = 0; i < 2; i++) await attempt(t.email, "Errada12345");
    expect((await attempt(t.email, PW)).r.status).toBe(200);
    expect(await typesFor(t.tenantId)).not.toContain("security.suspicious_login");
  });

  it("o bloqueio da conta avisa o titular, mesmo sem conseguir entrar; não pode ser silenciado", async () => {
    const t = await signupCompany();
    // tenta silenciar avisos de segurança: não tem efeito
    await t.client.put("/api/notifications/preferences", { mutedTypes: ["security"], emailEnabled: true, quietStartHour: null, quietEndHour: null }).catch(() => {});
    for (let i = 0; i < 5; i++) await attempt(t.email, "Errada12345");
    const locked = await attempt(t.email, PW);
    expect(locked.r.status).toBe(429);
    expect(await typesFor(t.tenantId)).toContain("security.account_locked");
  });
});
