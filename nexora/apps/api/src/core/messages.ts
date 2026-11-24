/**
 * Catálogo de mensagens geradas pelo servidor (notificações e e-mails) em PT e EN.
 * As notificações guardam a chave e os parâmetros e são apresentadas no idioma de quem as lê;
 * os e-mails usam o idioma do destinatário. Para um novo idioma, acrescente uma coluna a cada entrada.
 */
export type Locale = "pt" | "en";
export type Param = string | number | Msg;
export type Msg = { key: string; params?: Record<string, Param> };

const M: Record<string, Record<Locale, string>> = {
  // Segurança
  "security.new_device.title": { pt: "Novo dispositivo com acesso à sua conta", en: "New device signed in to your account" },
  "security.new_device.body": {
    pt: "Início de sessão a partir de {agent} (IP {ip}). Se não foi você, termine a sessão e altere a palavra-passe.",
    en: "Sign-in from {agent} (IP {ip}). If this wasn't you, end the session and change your password.",
  },
  "security.unknown_device": { pt: "dispositivo desconhecido", en: "unknown device" },
  "ownership.transfer.title": { pt: "Pedido de transferência de administração principal", en: "Primary administrator transfer request" },
  "ownership.transfer.body": {
    pt: "{name} pediu para lhe transferir a administração principal. Confirme em Definições.",
    en: "{name} asked to transfer primary administration to you. Confirm in Settings.",
  },
  // Stock, finanças, IA
  "inventory.transfer_request.title": { pt: "Guia de transferência {number} aguarda aprovação", en: "Transfer order {number} awaits approval" },
  "finance.approval.title": { pt: "Despesa aguarda aprovação", en: "Expense awaits approval" },
  "ai.approval.title": { pt: "Ação da IA aguarda aprovação", en: "AI action awaits approval" },
  "ai.alert.low_stock.title": { pt: "{count} produto(s) com stock baixo", en: "{count} product(s) low on stock" },
  "ai.alert.out_of_stock.title": { pt: "{count} produto(s) com stock baixo (há ruturas)", en: "{count} product(s) low on stock (some out of stock)" },
  "ai.alert.expense.title": { pt: "Despesa invulgarmente elevada", en: "Unusually high expense" },
  "ai.alert.expense.body": {
    pt: "{category}: {amount} (mais de {multiplier}× a média recente de {avg}).",
    en: "{category}: {amount} (more than {multiplier}× the recent average of {avg}).",
  },
  "ai.alert.sales_drop.title": { pt: "Vendas a cair cerca de {drop}% este mês", en: "Sales down about {drop}% this month" },
  "ai.alert.sales_drop.body": {
    pt: "Projeção {projected} vs média de {base} nos 3 meses anteriores. Estimativa, não certeza.",
    en: "Projection {projected} vs an average of {base} over the previous 3 months. An estimate, not a certainty.",
  },
  // Subscrição
  "billing.renewal.title": { pt: "Fatura de renovação emitida", en: "Renewal invoice issued" },
  "billing.renewal.body": { pt: "Vence em {date}.", en: "Due on {date}." },
  "trial.expired.title": { pt: "A demonstração terminou", en: "The trial has ended" },
  "trial.expired.body": { pt: "Converta para um plano pago para continuar.", en: "Convert to a paid plan to continue." },
  "trial.ending.title": { pt: "A demonstração termina em breve", en: "The trial ends soon" },
  "trial.ending.body": { pt: "Termina a {date}.", en: "Ends on {date}." },
  "billing.grace.title": { pt: "Pagamento em atraso: acesso normal até ao 3.º dia.", en: "Payment overdue: normal access until day 3." },
  "billing.read_only.title": { pt: "Pagamento em atraso: modo somente leitura (dias 4–8).", en: "Payment overdue: read-only mode (days 4–8)." },
  "billing.suspended.title": { pt: "Subscrição suspensa por falta de pagamento. Os dados estão preservados.", en: "Subscription suspended for non-payment. Your data is preserved." },
  // Incidentes
  "incident.update.title": { pt: "Incidente: {title} — {status}", en: "Incident: {title} — {status}" },
  "incident.status.investigating": { pt: "Em investigação", en: "Investigating" },
  "incident.status.identified": { pt: "Causa identificada", en: "Cause identified" },
  "incident.status.monitoring": { pt: "Em monitorização", en: "Monitoring" },
  "incident.status.resolved": { pt: "Resolvido", en: "Resolved" },
  // E-mails
  "mail.subject_prefix": { pt: "[Nexora] {title}", en: "[Nexora] {title}" },
  "mail.welcome.subject": { pt: "Bem-vindo à Nexora", en: "Welcome to Nexora" },
  "mail.welcome.body": { pt: "A empresa {company} foi registada.", en: "The company {company} has been registered." },
  "mail.reset.subject": { pt: "Recuperação de palavra-passe", en: "Password recovery" },
  "mail.reset.body": { pt: "Use este link (válido 30 min): {link}", en: "Use this link (valid for 30 min): {link}" },
  "mail.invite.subject": { pt: "Convite para {company} na Nexora", en: "Invitation to {company} on Nexora" },
  "mail.invite.body": { pt: "Foi convidado(a) por {name}. Aceite aqui (válido 7 dias): {link}", en: "You were invited by {name}. Accept here (valid for 7 days): {link}" },
};

export const MESSAGE_KEYS = Object.keys(M);

export const m = (key: string, params?: Record<string, Param>): Msg => {
  if (!M[key]) throw new Error(`Mensagem desconhecida: ${key}`);
  return { key, params };
};

export const isMsg = (v: unknown): v is Msg => !!v && typeof v === "object" && typeof (v as Msg).key === "string";

export const asLocale = (v: unknown): Locale => (v === "en" ? "en" : "pt");

/** Texto final no idioma pedido; parâmetros podem ser outras mensagens. Chaves desconhecidas devolvem a chave. */
export function render(v: string | Msg | null | undefined, locale: Locale = "pt"): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  const tpl = M[v.key]?.[locale] ?? M[v.key]?.pt ?? v.key;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const p = v.params?.[k];
    return p === undefined ? `{${k}}` : typeof p === "object" ? render(p, locale) : String(p);
  });
}
