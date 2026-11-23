import { and, eq } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client.js";
import { memberships, notifications, users } from "../db/schema.js";
import nodemailer from "nodemailer";
import { config } from "../config.js";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
import { effectivePermissions, activeModulesOf } from "./context.js";

/** Transporte de e-mail desacoplado. "console" em desenvolvimento; integrar fornecedor real em produção. */
export async function sendMail(to: string, subject: string, body: string) {
  if (config.mailTransport === "console") {
    if (!config.isTest) console.log(`\n📧 [mail] Para: ${to}\nAssunto: ${subject}\n${body}\n`);
    return;
  }
  if (config.mailTransport === "smtp") {
    try {
      transporter ??= nodemailer.createTransport(process.env.SMTP_URL!);
      await transporter.sendMail({ from: process.env.MAIL_FROM ?? "Nexora <no-reply@nexora.local>", to, subject, text: body });
    } catch (e) {
      // Falha de e-mail nunca interrompe a operação de negócio; fica registada nos logs.
      console.error(`[mail] falha ao enviar para ${to}:`, (e as Error).message);
    }
    return;
  }
  console.warn(`[mail] transporte "${config.mailTransport}" desconhecido; e-mail para ${to} não enviado.`);
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
