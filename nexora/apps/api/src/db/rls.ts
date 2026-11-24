/**
 * Row-Level Security (ADR-0003). Idempotente: corre após as migrations em cada arranque, por isso
 * as tabelas novas com `tenant_id` ficam automaticamente protegidas.
 *
 * - Papel `nexora_tenant` (NOLOGIN, sem BYPASSRLS) com acesso às tabelas; o papel de ligação da
 *   aplicação torna-se membro para poder fazer `SET ROLE` nas ligações de pedidos de empresa.
 * - Em cada tabela com `tenant_id` (e em `tenants`, por `id`), a política só restringe quando o papel
 *   ativo é `nexora_tenant`: aí só passam linhas da empresa em `app.tenant_id` — leitura e escrita.
 *   Sem empresa definida não passa nada (falha fechada).
 */
import { config } from "../config.js";
import { setRlsReady, sql, TENANT_ROLE } from "./client.js";

const cond = (col: string) => `(current_user <> '${TENANT_ROLE}' or ${col} = nullif(current_setting('app.tenant_id', true), '')::uuid)`;

export async function ensureRls(log: (m: string) => void = () => {}) {
  if (config.dbRls === "off") {
    setRlsReady(false);
    return { enabled: false, tables: 0 };
  }
  try {
    await sql.unsafe(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = '${TENANT_ROLE}') then
          create role ${TENANT_ROLE} nologin nobypassrls;
        end if;
      end $$;
    `);
    const [me] = await sql`select rolsuper from pg_roles where rolname = current_user`;
    if (!me.rolsuper) await sql.unsafe(`grant ${TENANT_ROLE} to current_user`);
    await sql.unsafe(`
      grant usage on schema public to ${TENANT_ROLE};
      grant select, insert, update, delete on all tables in schema public to ${TENANT_ROLE};
      grant usage, select on all sequences in schema public to ${TENANT_ROLE};
    `);
    const tables = await sql<{ table_name: string }[]>`
      select distinct c.table_name from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.column_name = 'tenant_id' order by 1`;
    const targets: [string, string][] = [["tenants", "id"], ...tables.map((t) => [t.table_name, "tenant_id"] as [string, string])];
    for (const [table, col] of targets) {
      const q = `"${table.replace(/"/g, "")}"`;
      await sql.unsafe(`
        alter table ${q} enable row level security;
        drop policy if exists nx_tenant_isolation on ${q};
        create policy nx_tenant_isolation on ${q} using ${cond(col)} with check ${cond(col)};
      `);
    }
    setRlsReady(true);
    log(`RLS ativo em ${targets.length} tabelas.`);
    return { enabled: true, tables: targets.length };
  } catch (e) {
    setRlsReady(false);
    if (config.dbRls === "required") throw e;
    log(`RLS não ativado (${(e as Error).message}). O isolamento continua garantido pela aplicação.`);
    return { enabled: false, tables: 0 };
  }
}

/** Deteta (sem alterar nada) se o RLS está pronto a usar neste processo. */
export async function detectRls() {
  if (config.dbRls === "off") return setRlsReady(false);
  const [role] = await sql`select 1 from pg_roles where rolname = ${TENANT_ROLE}`;
  const [r] = role
    ? await sql`select (select rolsuper from pg_roles where rolname = current_user) or pg_has_role(current_user, ${TENANT_ROLE}, 'member') as can,
        (select count(*)::int from pg_policies where policyname = 'nx_tenant_isolation') as policies`
    : [{ can: false, policies: 0 }];
  const ok = !!r.can && r.policies > 0;
  if (!ok && config.dbRls === "required") throw new Error("DB_RLS=required mas o RLS não está configurado (corra as migrations).");
  setRlsReady(ok);
}
