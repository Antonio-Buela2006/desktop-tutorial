/** RLS (ADR-0003): a base de dados recusa linhas de outra empresa, mesmo sem filtro na aplicação. */
import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql as sqlTag } from "drizzle-orm";
import { Client, getApp, signupCompany } from "./helpers.js";
import { buildApp } from "../app.js";
import { requireCtx } from "../core/context.js";
import { db, dbScope, openTenantScope, rlsEnabled, sql } from "../db/client.js";
import { customers, tenants } from "../db/schema.js";

let a: Awaited<ReturnType<typeof signupCompany>>;
let b: Awaited<ReturnType<typeof signupCompany>>;
let custB: string;

async function asTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  const scope = await openTenantScope(tenantId);
  try {
    return await dbScope.run(scope, fn);
  } finally {
    await scope.release?.();
  }
}

beforeAll(async () => {
  await getApp();
  a = await signupCompany();
  b = await signupCompany();
  await a.client.post("/api/crm/customers", { name: "Cliente A RLS" });
  custB = (await b.client.post("/api/crm/customers", { name: "Cliente B RLS" })).body.id;
});

describe("row-level security", () => {
  it("está ativo e as tabelas com tenant_id têm política", async () => {
    expect(rlsEnabled()).toBe(true);
    const missing = await sql`
      select distinct c.table_name from information_schema.columns c
      join information_schema.tables t using (table_schema, table_name)
      where c.table_schema = 'public' and c.column_name = 'tenant_id' and t.table_type = 'BASE TABLE'
        and not exists (select 1 from pg_policies p where p.tablename = c.table_name and p.policyname = 'nx_tenant_isolation')`;
    expect(missing).toEqual([]);
  });

  it("consultas sem filtro só devolvem linhas da empresa do pedido", async () => {
    const rows = await asTenant(a.tenantId, () => db.select().from(customers));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === a.tenantId)).toBe(true);
    // pedir diretamente a linha de outra empresa não devolve nada
    expect(await asTenant(a.tenantId, () => db.select().from(customers).where(eq(customers.id, custB)))).toEqual([]);
    const ts = await asTenant(a.tenantId, () => db.select({ id: tenants.id }).from(tenants));
    expect(ts).toEqual([{ id: a.tenantId }]);
  });

  it("não deixa escrever, alterar nem apagar linhas de outra empresa", async () => {
    const err = await asTenant(a.tenantId, () => db.insert(customers).values({ tenantId: b.tenantId, name: "Intruso" })).catch((e) => e);
    expect(String(err?.cause?.message ?? err)).toMatch(/row-level security/);
    const upd = await asTenant(a.tenantId, () => db.update(customers).set({ name: "Alterado" }).where(eq(customers.id, custB)).returning());
    expect(upd).toEqual([]);
    const del = await asTenant(a.tenantId, () => db.delete(customers).where(eq(customers.id, custB)).returning());
    expect(del).toEqual([]);
    const [still] = await db.select().from(customers).where(eq(customers.id, custB));
    expect(still.name).toBe("Cliente B RLS");
  });

  it("transações e savepoints funcionam na ligação da empresa e revertem em erro", async () => {
    await expect(
      asTenant(a.tenantId, () =>
        db.transaction(async (tx) => {
          await tx.insert(customers).values({ tenantId: a.tenantId, name: "Revertido RLS" });
          await tx.transaction(async (t2) => {
            await t2.insert(customers).values({ tenantId: a.tenantId, name: "Savepoint RLS" });
          });
          throw new Error("falha");
        }),
      ),
    ).rejects.toThrow("falha");
    const rows = await db.select().from(customers).where(eq(customers.tenantId, a.tenantId));
    expect(rows.some((r) => r.name === "Revertido RLS" || r.name === "Savepoint RLS")).toBe(false);
  });

  it("sem empresa definida o papel restrito não vê nada (falha fechada)", async () => {
    const conn = await sql.reserve();
    try {
      await conn.unsafe("set role nexora_tenant");
      expect(await conn`select id from customers`).toHaveLength(0);
    } finally {
      await conn.unsafe("reset role");
      conn.release();
    }
  });

  it("a ligação volta limpa ao pool depois do pedido", async () => {
    await a.client.get("/api/crm/customers");
    const rows = await Promise.all(Array.from({ length: 12 }, () => sql`select current_user as u, current_setting('app.tenant_id', true) as t`));
    for (const r of rows) {
      expect(r[0].u).not.toBe("nexora_tenant");
      expect(r[0].t ?? "").toBe("");
    }
  });

  it("os pedidos HTTP de uma empresa correm no papel restrito, incluindo dentro de transações", async () => {
    const app = await buildApp();
    app.get("/api/__rls_probe", async (req) => {
      requireCtx(req);
      const [plain] = await db.execute<{ u: string; t: string }>(sqlTag`select current_user as u, current_setting('app.tenant_id', true) as t` as any);
      const inTx = await db.transaction(async (tx) => (await tx.execute<{ u: string }>(sqlTag`select current_user as u` as any))[0]);
      await new Promise((r) => setTimeout(r, 5));
      const [later] = await db.execute<{ t: string }>(sqlTag`select current_setting('app.tenant_id', true) as t` as any);
      return { plain, inTx, later };
    });
    const c = new Client(app);
    c.cookie = a.client.cookie;
    const r = await c.get("/api/__rls_probe");
    expect(r.body).toEqual({ plain: { u: "nexora_tenant", t: a.tenantId }, inTx: { u: "nexora_tenant" }, later: { t: a.tenantId } });
    // sem sessão de empresa usa o pool geral
    const anon = await new Client(app).get("/api/health");
    expect(anon.status).toBe(200);
    await app.close();
  });
});
