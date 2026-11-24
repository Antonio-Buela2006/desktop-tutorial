import { and, eq } from "drizzle-orm";
import { db, type DbOrTx } from "../db/client.js";
import { memberships, notificationPreferences, notifications, users } from "../db/schema.js";
import nodemailer from "nodemailer";
import { config } from "../config.js";
import { asLocale, isMsg, m, render, type Msg } from "./messages.js";

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

type NotifyInput = { type: string; title: string | Msg; body?: string | Msg; severity?: "info" | "warning" | "critical"; link?: string; dedupeKey?: string };

/** Tipos que nunca podem ser silenciados (segurança da conta e estado da subscrição). */
export const UNMUTABLE_PREFIXES = ["security.", "billing.", "trial.", "ownership.", "incident."];
const unmutable = (type: string) => UNMUTABLE_PREFIXES.some((p) => type.startsWith(p));

export type Prefs = typeof notificationPreferences.$inferSelect;

/** Está dentro do horário de silêncio? (suporta intervalos que atravessam a meia-noite). Hora em UTC+1 (Angola). */
export function inQuietHours(p: Pick<Prefs, "quietStartHour" | "quietEndHour"> | undefined, now = new Date()) {
  if (!p || p.quietStartHour === null || p.quietEndHour === null || p.quietStartHour === p.quietEndHour) return false;
  const h = (now.getUTCHours() + 1) % 24;
  return p.quietStartHour < p.quietEndHour ? h >= p.quietStartHour && h < p.quietEndHour : h >= p.quietStartHour || h < p.quietEndHour;
}

async function prefsOf(membershipId: string, tx: DbOrTx = db) {
  const [p] = await tx.select().from(notificationPreferences).where(eq(notificationPreferences.membershipId, membershipId));
  return p;
}

/** Cria a notificação no sistema, salvo se o utilizador silenciou este tipo. Devolve se foi criada. */
export async function notifyMembership(tenantId: string, membershipId: string, n: NotifyInput, tx: DbOrTx = db) {
  if (!unmutable(n.type)) {
    const p = await prefsOf(membershipId, tx);
    if (p?.mutedTypes.some((m) => n.type === m || n.type.startsWith(m + "."))) return false;
  }
  const r = await tx
    .insert(notifications)
    .values({
      tenantId,
      membershipId,
      type: n.type,
      title: render(n.title, "pt"),
      body: render(n.body, "pt"),
      i18n: isMsg(n.title) || isMsg(n.body) ? { title: isMsg(n.title) ? n.title : undefined, body: isMsg(n.body) ? n.body : undefined } : null,
      severity: n.severity ?? "info",
      link: n.link,
      dedupeKey: n.dedupeKey ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  return r.length > 0;
}

/**
 * Notifica todos os membros ativos com uma permissão (respeita RBAC e módulos).
 * E-mail: só para notificações novas (sem duplicados), se o utilizador o tiver ativo e fora do horário
 * de silêncio — exceto severidade crítica.
 */
export async function notifyByPermission(tenantId: string, perm: string, n: NotifyInput, opts: { email?: boolean } = {}) {
  const rows = await db
    .select({ m: memberships, email: users.email, locale: users.locale })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.status, "active")));
  const modules = await activeModulesOf(tenantId);
  let sent = 0;
  for (const r of rows) {
    const perms = await effectivePermissions(r.m, modules);
    if (!perms.has(perm)) continue;
    const created = await notifyMembership(tenantId, r.m.id, n);
    if (!created) continue;
    sent++;
    if (opts.email) {
      const p = await prefsOf(r.m.id);
      const emailOn = p?.emailEnabled ?? true;
      if ((emailOn || unmutable(n.type)) && (n.severity === "critical" || !inQuietHours(p))) {
        const lc = asLocale(r.locale);
        await sendMail(r.email, render(m("mail.subject_prefix", { title: n.title }), lc), render(n.body, lc));
      }
    }
  }
  return sent;
}

/** Apresenta uma notificação guardada no idioma do leitor (usa o texto guardado se não houver chave). */
export function localizeNotification<T extends { title: string; body: string; i18n?: { title?: Msg; body?: Msg } | null }>(n: T, locale: string) {
  const lc = asLocale(locale);
  const { i18n, ...rest } = n;
  return { ...rest, title: i18n?.title ? render(i18n.title, lc) : n.title, body: i18n?.body ? render(i18n.body, lc) : n.body };
}
