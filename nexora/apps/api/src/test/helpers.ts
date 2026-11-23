import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

let appPromise: Promise<FastifyInstance> | null = null;
export const getApp = () => (appPromise ??= buildApp());

let counter = 0;
export const uniq = (p = "t") => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Cliente HTTP de teste com cookie de sessão próprio. */
export class Client {
  cookie = "";
  constructor(private app: FastifyInstance) {}
  async req(method: string, url: string, body?: unknown, extraHeaders: Record<string, string> = {}) {
    const res = await this.app.inject({
      method: method as any,
      url,
      payload: body === undefined ? undefined : JSON.stringify(body),
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), "x-nexora-csrf": "1", ...(this.cookie ? { cookie: this.cookie } : {}), ...extraHeaders },
    });
    const set = res.headers["set-cookie"];
    if (set) {
      const arr = Array.isArray(set) ? set : [set];
      for (const c of arr) {
        const [pair] = c.split(";");
        const [name] = pair.split("=");
        const rest = this.cookie.split("; ").filter((x) => x && !x.startsWith(name + "="));
        this.cookie = [...rest, pair].join("; ");
      }
    }
    let json: any = null;
    try {
      json = res.json();
    } catch {
      json = res.body;
    }
    return { status: res.statusCode, body: json };
  }
  get = (u: string) => this.req("GET", u);
  post = (u: string, b: unknown = {}) => this.req("POST", u, b);
  put = (u: string, b: unknown) => this.req("PUT", u, b);
  del = (u: string) => this.req("DELETE", u);
}

export async function signupCompany(opts: { mode?: "trial" | "paid"; plan?: string; modules?: string[] } = {}) {
  const app = await getApp();
  const c = new Client(app);
  const email = `${uniq("admin")}@test.invalid`;
  const r = await c.post("/api/auth/signup", {
    company: { name: `Empresa ${uniq()}` },
    admin: { name: "Admin Teste", email, password: "SenhaForte123" },
    planCode: opts.plan ?? "starter",
    modules: opts.modules ?? ["crm", "inventory"],
    mode: opts.mode ?? "trial",
    acceptTerms: true,
  });
  if (r.status !== 200) throw new Error("signup falhou: " + JSON.stringify(r.body));
  // Política por omissão exige 2FA a administradores; nos testes desligamos para simplificar,
  // excepto nos testes que validam precisamente o 2FA.
  const { db } = await import("../db/client.js");
  const { tenants } = await import("../db/schema.js");
  const { eq } = await import("drizzle-orm");
  const [t] = await db.select().from(tenants).where(eq(tenants.id, r.body.tenantId));
  await db.update(tenants).set({ settings: { ...t.settings, require2fa: "off" } }).where(eq(tenants.id, t.id));
  return { client: c, email, tenantId: r.body.tenantId as string, invoiceId: r.body.invoiceId as string | null };
}

/** Convida e ativa um utilizador com as funções indicadas (códigos). */
export async function addMember(admin: Client, roleCodes: string[], level: "member" | "secondary_admin" = "member") {
  const app = await getApp();
  const roles = (await admin.get("/api/company/roles")).body as any[];
  const roleIds = roleCodes.map((c) => roles.find((r) => r.code === c)!.id);
  const email = `${uniq("user")}@test.invalid`;
  const inv = await admin.post("/api/company/users/invite", { email, name: "Membro Teste", roleIds, level });
  if (inv.status !== 200) throw new Error("invite falhou: " + JSON.stringify(inv.body));
  const token = new URL(inv.body.devLink).searchParams.get("token");
  const u = new Client(app);
  const acc = await u.post("/api/auth/invitations/accept", { token, password: "SenhaMembro123" });
  if (acc.status !== 200) throw new Error("accept falhou: " + JSON.stringify(acc.body));
  const me = await u.get("/api/auth/me");
  return { client: u, email, membershipId: me.body.membership.id as string };
}
