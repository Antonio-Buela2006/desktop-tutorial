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
  "inventory.transfer_discrepancy.title": { pt: "Guia {number} recebida com diferenças", en: "Transfer order {number} received with discrepancies" },
  "inventory.transfer_discrepancy.body": { pt: "Recebido/expedido: {lines}. Motivo: {note}", en: "Received/shipped: {lines}. Reason: {note}" },
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
  // Registo de auditoria: descrição da ação (o resumo original fica imutável na cadeia de hash)
  "audit.admin.jobs_run": { pt: "Tarefas automáticas executadas", en: "Scheduled jobs run" },
  "audit.admin.login": { pt: "Entrada no portal Nexora", en: "Nexora portal sign-in" },
  "audit.admin.mfa_enabled": { pt: "2FA ativado no portal Nexora", en: "2FA enabled on the Nexora portal" },
  "audit.admin.module_updated": { pt: "Módulo do catálogo alterado", en: "Catalog module updated" },
  "audit.admin.payment_reconciled": { pt: "Pagamento reconciliado", en: "Payment reconciled" },
  "audit.admin.plan_updated": { pt: "Plano alterado", en: "Plan updated" },
  "audit.admin.retention_executed": { pt: "Retenção de dados aplicada", en: "Data retention applied" },
  "audit.admin.setting_updated": { pt: "Configuração da plataforma alterada", en: "Platform setting updated" },
  "audit.admin.trial_extended": { pt: "Demonstração prolongada", en: "Trial extended" },
  "audit.ai.action_approved": { pt: "Ação da IA aprovada", en: "AI action approved" },
  "audit.ai.action_canceled": { pt: "Ação da IA cancelada", en: "AI action canceled" },
  "audit.ai.action_executed": { pt: "Ação da IA executada", en: "AI action executed" },
  "audit.ai.action_failed": { pt: "Ação da IA falhou", en: "AI action failed" },
  "audit.ai.action_proposed": { pt: "A IA propôs uma ação", en: "AI proposed an action" },
  "audit.ai.action_rejected": { pt: "Ação da IA rejeitada", en: "AI action rejected" },
  "audit.ai.credits_purchase_requested": { pt: "Pedido de compra de créditos de IA", en: "AI credits purchase requested" },
  "audit.ai.policy_updated": { pt: "Políticas de IA alteradas", en: "AI policies updated" },
  "audit.ai.request": { pt: "Pedido ao assistente de IA", en: "AI assistant request" },
  "audit.ai.tool": { pt: "Ferramenta usada pela IA", en: "Tool used by the AI" },
  "audit.alerts.updated": { pt: "Configuração de alertas alterada", en: "Alert settings updated" },
  "audit.auth.account_locked": { pt: "Conta bloqueada temporariamente", en: "Account temporarily locked" },
  "audit.auth.login": { pt: "Início de sessão", en: "Sign-in" },
  "audit.auth.mfa_disabled": { pt: "2FA desativado", en: "2FA disabled" },
  "audit.auth.mfa_enabled": { pt: "2FA ativado", en: "2FA enabled" },
  "audit.auth.mfa_verified": { pt: "2FA validado", en: "2FA verified" },
  "audit.auth.password_changed": { pt: "Palavra-passe alterada", en: "Password changed" },
  "audit.auth.password_reset": { pt: "Palavra-passe redefinida", en: "Password reset" },
  "audit.auth.session_revoked": { pt: "Sessão terminada", en: "Session ended" },
  "audit.branch.created": { pt: "Unidade criada", en: "Branch created" },
  "audit.branch.updated": { pt: "Unidade alterada", en: "Branch updated" },
  "audit.customer.created": { pt: "Cliente criado", en: "Customer created" },
  "audit.customer.deleted": { pt: "Cliente eliminado", en: "Customer deleted" },
  "audit.customer.updated": { pt: "Cliente alterado", en: "Customer updated" },
  "audit.employee.anonymized": { pt: "Funcionário anonimizado", en: "Employee anonymized" },
  "audit.employee.created": { pt: "Funcionário registado", en: "Employee created" },
  "audit.employee.deleted": { pt: "Funcionário eliminado", en: "Employee deleted" },
  "audit.employee.offboarded": { pt: "Saída de funcionário registada", en: "Employee offboarded" },
  "audit.employee.updated": { pt: "Funcionário alterado", en: "Employee updated" },
  "audit.export.created": { pt: "Exportação de dados", en: "Data export" },
  "audit.file.deleted": { pt: "Ficheiro eliminado", en: "File deleted" },
  "audit.file.downloaded": { pt: "Ficheiro descarregado", en: "File downloaded" },
  "audit.file.uploaded": { pt: "Ficheiro carregado", en: "File uploaded" },
  "audit.finance.created": { pt: "Movimento financeiro registado", en: "Financial transaction recorded" },
  "audit.finance.deleted": { pt: "Movimento financeiro eliminado", en: "Financial transaction deleted" },
  "audit.finance.approved": { pt: "Movimento financeiro aprovado", en: "Financial transaction approved" },
  "audit.finance.rejected": { pt: "Movimento financeiro rejeitado", en: "Financial transaction rejected" },
  "audit.import.customers": { pt: "Importação de clientes", en: "Customer import" },
  "audit.import.products": { pt: "Importação de produtos", en: "Product import" },
  "audit.incident.opened": { pt: "Incidente aberto", en: "Incident opened" },
  "audit.incident.updated": { pt: "Incidente atualizado", en: "Incident updated" },
  "audit.inventory.adjusted": { pt: "Stock ajustado", en: "Stock adjusted" },
  "audit.inventory.transferred": { pt: "Stock transferido", en: "Stock transferred" },
  "audit.ownership.transfer_requested": { pt: "Pedida transferência de administração principal", en: "Primary administrator transfer requested" },
  "audit.ownership.transferred": { pt: "Administração principal transferida", en: "Primary administration transferred" },
  "audit.payment.amount_mismatch": { pt: "Valor do pagamento não corresponde", en: "Payment amount mismatch" },
  "audit.payment.confirmed": { pt: "Pagamento confirmado", en: "Payment confirmed" },
  "audit.payment.failed": { pt: "Pagamento falhou", en: "Payment failed" },
  "audit.payment.initiated": { pt: "Pagamento iniciado", en: "Payment initiated" },
  "audit.product.created": { pt: "Produto criado", en: "Product created" },
  "audit.product.deleted": { pt: "Produto eliminado", en: "Product deleted" },
  "audit.product.updated": { pt: "Produto alterado", en: "Product updated" },
  "audit.retention.tenant_purged": { pt: "Dados de empresa cancelada eliminados", en: "Canceled company data purged" },
  "audit.retention.trash_purged": { pt: "Lixeira esvaziada", en: "Trash purged" },
  "audit.retention.trial_purged": { pt: "Dados de demonstração expirada eliminados", en: "Expired trial data purged" },
  "audit.role.created": { pt: "Função criada", en: "Role created" },
  "audit.role.deleted": { pt: "Função eliminada", en: "Role deleted" },
  "audit.role.updated": { pt: "Função alterada", en: "Role updated" },
  "audit.sale.canceled": { pt: "Venda anulada", en: "Sale canceled" },
  "audit.sale.created": { pt: "Venda registada", en: "Sale recorded" },
  "audit.security.ip_blocked": { pt: "IP bloqueado", en: "IP blocked" },
  "audit.settings.updated": { pt: "Definições da empresa alteradas", en: "Company settings updated" },
  "audit.subscription.activated": { pt: "Subscrição ativada", en: "Subscription activated" },
  "audit.subscription.cancel_reverted": { pt: "Cancelamento da subscrição revertido", en: "Subscription cancellation reverted" },
  "audit.subscription.cancel_scheduled": { pt: "Cancelamento da subscrição agendado", en: "Subscription cancellation scheduled" },
  "audit.subscription.canceled": { pt: "Subscrição cancelada", en: "Subscription canceled" },
  "audit.subscription.capacity_requested": { pt: "Pedido de capacidade adicional", en: "Additional capacity requested" },
  "audit.subscription.conversion_requested": { pt: "Pedido de conversão para plano pago", en: "Conversion to paid plan requested" },
  "audit.subscription.modules_changed": { pt: "Módulos da subscrição alterados", en: "Subscription modules changed" },
  "audit.subscription.plan_changed": { pt: "Plano da subscrição alterado", en: "Subscription plan changed" },
  "audit.support.data_accessed": { pt: "Suporte Nexora acedeu a dados", en: "Nexora support accessed data" },
  "audit.support.grant_created": { pt: "Acesso de suporte autorizado", en: "Support access granted" },
  "audit.support.grant_revoked": { pt: "Acesso de suporte revogado", en: "Support access revoked" },
  "audit.tenant.registered": { pt: "Empresa registada", en: "Company registered" },
  "audit.transfer.canceled": { pt: "Guia de transferência cancelada", en: "Transfer order canceled" },
  "audit.transfer.received": { pt: "Guia de transferência recebida", en: "Transfer order received" },
  "audit.transfer.discrepancy": { pt: "Receção de guia com diferenças", en: "Transfer order received with discrepancies" },
  "audit.transfer.rejected": { pt: "Guia de transferência rejeitada", en: "Transfer order rejected" },
  "audit.transfer.requested": { pt: "Guia de transferência pedida", en: "Transfer order requested" },
  "audit.transfer.shipped": { pt: "Guia de transferência expedida", en: "Transfer order shipped" },
  "audit.trash.restored": { pt: "Registo restaurado da lixeira", en: "Record restored from trash" },
  "audit.user.access_changed": { pt: "Acessos do utilizador alterados", en: "User access changed" },
  "audit.user.branches_changed": { pt: "Unidades do utilizador alteradas", en: "User branches changed" },
  "audit.user.disabled": { pt: "Utilizador desativado", en: "User disabled" },
  "audit.user.enabled": { pt: "Utilizador reativado", en: "User enabled" },
  "audit.user.invitation_accepted": { pt: "Convite aceite", en: "Invitation accepted" },
  "audit.user.invitation_revoked": { pt: "Convite revogado", en: "Invitation revoked" },
  "audit.user.invited": { pt: "Utilizador convidado", en: "User invited" },
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

/** Descrição da ação de auditoria no idioma pedido; `null` se a ação não estiver no catálogo. */
export function auditActionLabel(action: string, locale: Locale): string | null {
  return M[`audit.${action}`] ? render({ key: `audit.${action}` }, locale) : null;
}
