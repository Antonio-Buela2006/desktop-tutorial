import { and, eq } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client.js";
import { memberships, notifications, users } from "../db/schema.js";
import { config } from "../config.js";
import { effectivePermissions, activeModulesOf } from "./context.js";

/** Transporte de e-mail desacoplado. "console" em desenvolvimento; integrar fornecedor real em produção. */
export async function sendMail(to: string, subject: string, body: string) {
  if (config.mailTransport === "console") {
    if (!config.isTest) console.log(`\n📧 [mail] Para: ${to}\nAssunto: ${subject}\n${body}\n`);
    return;
  }
  // Ponto de integração (Resend/SES/SMTP) — ver docs/architecture/integrations.md
  console.warn(`[mail] transporte "${config.mailTransport}" não configurado; e-mail para ${to} não enviado.`);
}

type NotifyInput = { type: string; title: string; body?: string; severity?: "info" | "warning" | "critical"; link?: string; dedupeKey?: string };

export async function notifyMembership(tenantId: string, membershipId: string, n: NotifyInput, tx: DbOrTx = db) {
  await tx
    .insert(notifications)
    .values({ tenantId, membershipId, type: n.type, title: n.title, body: n.body ?? "", severity: n.severity ?? "info", link: n.link, dedupeKey: n.dedupeKey ?? null })
    .onConflictDoNothing();
}

/** Notifica todos os membros ativos com uma permissão (respeita RBAC e módulos). */
export async function notifyByPermission(tenantId: string, perm: string, n: NotifyInput, opts: { email?: boolean } = {}) {
  const rows = await db
    .select({ m: memberships, email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.status, "active")));
  const modules = await activeModulesOf(tenantId);
  let sent = 0;
  for (const r of rows) {
    const perms = await effectivePermissions(r.m, modules);
    if (!perms.has(perm)) continue;
    await notifyMembership(tenantId, r.m.id, n);
    if (opts.email) await sendMail(r.email, `[Nexora] ${n.title}`, n.body ?? "");
    sent++;
  }
  return sent;
}
