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
  "ai.approval.body": { pt: "{requester} pediu à IA: {action}.", en: "{requester} asked the AI to: {action}." },
  // Pré-visualização das ações da IA
  "ai.action.create_customer": { pt: "Criar cliente", en: "Create customer" },
  "ai.action.adjust_stock": { pt: "Ajustar stock", en: "Adjust stock" },
  "ai.action.record_expense": { pt: "Registar despesa", en: "Record expense" },
  "ai.impact.create_customer": { pt: "Novo registo em Clientes; reversível (pode ser eliminado).", en: "New record in Customers; reversible (can be deleted)." },
  "ai.impact.record_expense": { pt: "Afeta o resultado financeiro do período.", en: "Affects the financial result for the period." },
  "ai.field.name": { pt: "Nome", en: "Name" },
  "ai.field.email": { pt: "E-mail", en: "Email" },
  "ai.field.phone": { pt: "Telefone", en: "Phone" },
  "ai.field.product": { pt: "Produto", en: "Product" },
  "ai.field.before": { pt: "Antes", en: "Before" },
  "ai.field.after": { pt: "Depois", en: "After" },
  "ai.field.reason": { pt: "Motivo", en: "Reason" },
  "ai.field.category": { pt: "Categoria", en: "Category" },
  "ai.field.amount": { pt: "Valor", en: "Amount" },
  "ai.field.date": { pt: "Data", en: "Date" },
  "ai.field.description": { pt: "Descrição", en: "Description" },
  "ai.field.data": { pt: "Dados", en: "Data" },
  "ai.field.impact": { pt: "Impacto", en: "Impact" },
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

/* -------- Pré-visualização das ações da IA -------- */
/** Pré-visualização guardada: `action` e `impact` são mensagens; os restantes campos são valores. */
export type ActionPreview = { action: Msg; impact?: Msg; [field: string]: unknown };

// Ações antigas guardadas com chaves e textos em português.
const LEGACY_FIELDS: Record<string, string> = { produto: "product", antes: "before", depois: "after", motivo: "reason", categoria: "category", valor: "amount", data: "date", descricao: "description", dados: "data" };
const legacyText = (pt: unknown): Msg | string => {
  const key = Object.keys(M).find((k) => (k.startsWith("ai.action.") || k.startsWith("ai.impact.")) && M[k].pt === pt);
  return key ? { key } : String(pt ?? "");
};

const FIELD_ORDER = ["name", "email", "phone", "product", "before", "after", "category", "amount", "date", "description", "reason", "data"];
const fieldRank = (f: string) => (FIELD_ORDER.includes(f) ? FIELD_ORDER.indexOf(f) : FIELD_ORDER.length);

const fmtValue = (v: unknown): string =>
  v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? Object.entries(v as object).map(([k, x]) => `${k}: ${x}`).join(", ") : String(v);

/** Pré-visualização pronta a mostrar no idioma do leitor: título, linhas (rótulo/valor) e impacto. */
export function describePreview(preview: Record<string, unknown> | null | undefined, tool: string, locale: Locale) {
  const p = preview ?? {};
  const legacy = "acao" in p;
  const title = legacy ? legacyText(p.acao) : isMsg(p.action) ? p.action : tool;
  const impact = legacy ? (p.impacto ? legacyText(p.impacto) : undefined) : isMsg(p.impact) ? p.impact : undefined;
  const rows = Object.entries(p)
    .filter(([k]) => !["acao", "impacto", "action", "impact"].includes(k))
    .map(([k, v]) => {
      const field = legacy ? LEGACY_FIELDS[k] ?? k : k;
      const label = M[`ai.field.${field}`] ? render({ key: `ai.field.${field}` }, locale) : field;
      return { field, label, value: fmtValue(v) };
    })
    // o jsonb não preserva a ordem das chaves: ordem fixa de apresentação
    .sort((a, b) => fieldRank(a.field) - fieldRank(b.field))
    .map(({ label, value }) => ({ label, value }));
  return { title: render(title, locale), rows, impact: impact ? render(impact, locale) : null };
}
