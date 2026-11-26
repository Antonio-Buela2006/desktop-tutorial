import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "../config.js";
import * as schema from "./schema.js";

export const sql = postgres(config.databaseUrl, { max: config.dbPoolMax, onnotice: () => {} });
const baseDb = drizzle(sql, { schema });
export type DB = typeof baseDb;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;
export { schema };

/** Papel de base de dados sujeito a RLS, usado nos pedidos de uma empresa. */
export const TENANT_ROLE = "nexora_tenant";

/**
 * Âmbito de base de dados do pedido. Quando um pedido pertence a uma empresa, fica com uma
 * ligação reservada que corre como `nexora_tenant` com `app.tenant_id` fixado: o PostgreSQL só
 * deixa ler e escrever linhas dessa empresa (defesa em profundidade, além dos filtros da aplicação).
 */
type Scope = { db?: DB; tenantId?: string; release?: () => Promise<void> };
export const dbScope = new AsyncLocalStorage<Scope>();

/**
 * `db` resolve para a ligação do pedido (com RLS) quando existe; caso contrário usa o pool geral
 * (portal Nexora, jobs, entrada e registo, que atravessam empresas por natureza).
 */
export const db: DB = new Proxy(baseDb, {
  get(target, prop) {
    const active = dbScope.getStore()?.db ?? target;
    const v = Reflect.get(active, prop, active);
    return typeof v === "function" ? v.bind(active) : v;
  },
});

/** Base sem âmbito de empresa — só para código que precisa deliberadamente de atravessar empresas. */
export const unscopedDb = baseDb;

let rlsReady = false;
export const rlsEnabled = () => rlsReady;
export function setRlsReady(v: boolean) {
  rlsReady = v;
}

/** Reserva uma ligação fixada na empresa e devolve o âmbito; `release` repõe a ligação no pool. */
export async function openTenantScope(tenantId: string): Promise<Scope> {
  const scope: Scope = { tenantId };
  if (!rlsReady) return scope;
  const conn = await sql.reserve();
  try {
    await conn`select set_config('app.tenant_id', ${tenantId}, false)`;
    await conn.unsafe(`set role ${TENANT_ROLE}`);
  } catch (e) {
    conn.release();
    throw e;
  }
  scope.db = drizzle(adaptReserved(conn), { schema });
  let released = false;
  scope.release = async () => {
    if (released) return;
    released = true;
    scope.db = undefined;
    try {
      await conn.unsafe("reset role; reset app.tenant_id");
      conn.release();
    } catch {
      // Ligação num estado desconhecido: não volta ao pool.
      try {
        await (conn as any).end?.();
      } catch {}
      conn.release();
    }
  };
  return scope;
}

/**
 * A ligação reservada do postgres.js não tem `begin`/`savepoint` nem `options`, que o Drizzle usa.
 * Este adaptador implementa-os sobre a mesma ligação (transações de um pedido são serializadas).
 */
function adaptReserved(conn: postgres.ReservedSql): postgres.Sql {
  let chain: Promise<unknown> = Promise.resolve();
  let sp = 0;
  const run = async <T>(open: string, ok: string, fail: string, fn: () => Promise<T>) => {
    await conn.unsafe(open);
    try {
      const r = await fn();
      await conn.unsafe(ok);
      return r;
    } catch (e) {
      await conn.unsafe(fail);
      throw e;
    }
  };
  const c = conn as any;
  c.options = sql.options;
  c.savepoint = (fn: (x: unknown) => Promise<unknown>) => {
    const name = `nx_sp_${++sp}`;
    return run(`savepoint ${name}`, `release savepoint ${name}`, `rollback to savepoint ${name}`, () => fn(c));
  };
  c.begin = (a: unknown, b?: unknown) => {
    const fn = (typeof a === "function" ? a : b) as (x: unknown) => Promise<unknown>;
    const mode = typeof a === "string" ? ` ${a}` : "";
    const p = chain.then(() => run(`begin${mode}`, "commit", "rollback", () => fn(c)));
    chain = p.catch(() => {});
    return p;
  };
  return c as postgres.Sql;
}
