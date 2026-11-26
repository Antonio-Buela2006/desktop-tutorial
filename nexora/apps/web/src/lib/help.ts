/**
 * Ajuda contextual da aplicação (spec 11), por página, em PT e EN.
 * É também a fonte do manual do utilizador (`pnpm --filter @nexora/web manual` gera docs/manuals/user*.md),
 * para que a ajuda e o manual nunca divirjam. Ao mudar uma página, atualize aqui.
 */
export type HelpEntry = { title: string; intro: string; steps: string[]; tips: string[] };
type Bi = { pt: HelpEntry; en: HelpEntry };

export const HELP: Record<string, Bi> = {
  "/app": {
    pt: {
      title: "Dashboard",
      intro: "Resumo do negócio: vendas do mês, stock baixo, resultado financeiro e clientes. Só aparecem os indicadores dos módulos contratados e a que tem acesso.",
      steps: ["Escolha uma unidade no seletor para ver só os números dessa unidade.", "Veja o gráfico \"Vendas por mês\" e a lista \"Produtos a repor\" (stock atual / nível de reposição).", "Siga o guia \"Primeiros passos\" até estar concluído."],
      tips: ["Os números de vendas excluem as vendas anuladas.", "Utilizadores restritos a unidades veem apenas as suas unidades."],
    },
    en: {
      title: "Dashboard",
      intro: "Business summary: sales this month, low stock, financial result and customers. Only indicators for contracted modules you can access are shown.",
      steps: ["Pick a branch in the selector to see that branch only.", "See the \"Sales by month\" chart and the \"Products to restock\" list (current stock / reorder level).", "Follow the \"Getting started\" guide until it is complete."],
      tips: ["Sales figures exclude canceled sales.", "Users restricted to branches only see their own branches."],
    },
  },
  "/app/customers": {
    pt: {
      title: "Clientes",
      intro: "Cadastro de clientes e contactos comerciais.",
      steps: ["\"Novo cliente\" para criar; o lápis edita e o caixote move para a lixeira.", "\"Importar CSV\" carrega muitos clientes de uma vez, com pré-visualização linha a linha antes de gravar.", "Selecione várias linhas e use \"Eliminar selecionados\" para eliminar em lote, com pré-visualização.", "O clipe anexa documentos ao cliente."],
      tips: ["Clique nos cabeçalhos \"Nome\" e \"Criado\" para ordenar.", "Os clientes eliminados podem ser restaurados na Lixeira durante o prazo configurado."],
    },
    en: {
      title: "Customers",
      intro: "Customer records and business contacts.",
      steps: ["\"New customer\" to create; the pencil edits and the bin moves to the trash.", "\"Import CSV\" loads many customers at once, with a line-by-line preview before saving.", "Select several rows and use \"Delete selected\" to bulk delete, with a preview.", "The paperclip attaches documents to the customer."],
      tips: ["Click the \"Name\" and \"Created\" headers to sort.", "Deleted customers can be restored from the Trash during the configured period."],
    },
  },
  "/app/products": {
    pt: {
      title: "Stock e inventário",
      intro: "Produtos, stock por localização (armazém central e unidades), ajustes e guias de transferência.",
      steps: ["\"Novo produto\" para criar; o ícone de caixa ajusta o stock com motivo obrigatório.", "\"Movimentos\" mostra o histórico de entradas e saídas.", "Separador \"Guias de transferência\": \"Nova guia\" pede uma transferência; outra pessoa aprova e expede; o destino confirma a receção, indicando o que chegou.", "Se chegar menos do que foi expedido, indique o motivo: a diferença fica registada como perda em trânsito."],
      tips: ["\"esgota em ~N dias\" é uma estimativa a partir das vendas dos últimos 90 dias.", "Produtos em guias por concluir não podem ser eliminados.", "Cada guia tem uma guia de transporte em PDF."],
    },
    en: {
      title: "Inventory",
      intro: "Products, stock per location (central warehouse and branches), adjustments and transfer orders.",
      steps: ["\"New product\" to create; the box icon adjusts stock with a mandatory reason.", "\"Movements\" shows the history of stock in and out.", "\"Transfer orders\" tab: \"New order\" requests a transfer; someone else approves and ships it; the destination confirms receipt, stating what arrived.", "If less arrives than was shipped, give the reason: the difference is recorded as a loss in transit."],
      tips: ["\"runs out in ~N days\" is an estimate based on the last 90 days of sales.", "Products in unfinished transfer orders cannot be deleted.", "Each order has a delivery note PDF."],
    },
  },
  "/app/sales": {
    pt: {
      title: "Vendas",
      intro: "Registo de vendas com baixa automática de stock da unidade da venda.",
      steps: ["\"Nova venda\": escolha o cliente (opcional), os produtos e as quantidades.", "Uma venda pode ser anulada; o stock é reposto na mesma localização.", "Use o seletor de unidade para filtrar."],
      tips: ["Não é possível vender mais do que o stock disponível na localização.", "As vendas não substituem faturação fiscal certificada (pendente de validação local)."],
    },
    en: {
      title: "Sales",
      intro: "Sales recording with automatic stock deduction from the sale's branch.",
      steps: ["\"New sale\": choose the customer (optional), products and quantities.", "A sale can be canceled; stock is returned to the same location.", "Use the branch selector to filter."],
      tips: ["You cannot sell more than the stock available at the location.", "Sales do not replace certified tax invoicing (pending local validation)."],
    },
  },
  "/app/finance": {
    pt: {
      title: "Finanças",
      intro: "Receitas e despesas, com aprovação por outra pessoa a partir do limite configurado, e previsão de tesouraria.",
      steps: ["\"Novo movimento\" regista uma receita ou despesa.", "Despesas acima do limite ficam \"Por aprovar\": outra pessoa com permissão aprova ou rejeita.", "Abra \"Previsão de tesouraria\" para ver receitas, despesas e saldo estimados dos próximos meses."],
      tips: ["Quem registou uma despesa não a pode aprovar (segregação de funções).", "A previsão é uma estimativa com intervalo, não uma certeza.", "Movimentos financeiros não são eliminados definitivamente (obrigação legal)."],
    },
    en: {
      title: "Finance",
      intro: "Income and expenses, with approval by someone else above the configured limit, and a cash-flow forecast.",
      steps: ["\"New transaction\" records income or an expense.", "Expenses above the limit are \"Pending approval\": someone else with permission approves or rejects them.", "Open \"Cash-flow forecast\" to see estimated income, expenses and balance for the coming months."],
      tips: ["Whoever recorded an expense cannot approve it (segregation of duties).", "The forecast is an estimate with an interval, not a certainty.", "Financial transactions are never permanently deleted (legal obligation)."],
    },
  },
  "/app/employees": {
    pt: {
      title: "Funcionários",
      intro: "Cadastro das pessoas da empresa, independente das contas de acesso.",
      steps: ["\"Novo funcionário\" para registar; o salário só é visível e ordenável para quem tem essa permissão.", "Registe a saída de um funcionário: o acesso associado é revogado e a vaga libertada, mantendo o histórico.", "Anexe documentos com o clipe."],
      tips: ["Os limites de funcionários e de utilizadores do plano são contados em separado."],
    },
    en: {
      title: "Employees",
      intro: "Records of the company's people, separate from login accounts.",
      steps: ["\"New employee\" to register; salary is only visible and sortable for those with that permission.", "Record an employee's departure: the linked access is revoked and the seat freed, keeping history.", "Attach documents with the paperclip."],
      tips: ["The plan's employee and user limits are counted separately."],
    },
  },
  "/app/users": {
    pt: {
      title: "Utilizadores",
      intro: "Contas com acesso à Nexora, as suas funções, permissões e unidades.",
      steps: ["\"Convidar\" envia um convite por e-mail (válido 7 dias).", "A chave abre os acessos: funções (também temporárias, com data de fim), ajustes de permissões e restrição a unidades.", "Desativar revoga o acesso de imediato e liberta a vaga."],
      tips: ["Quando o limite de utilizadores é atingido, não é possível convidar, mas as contas existentes continuam."],
    },
    en: {
      title: "Users",
      intro: "Accounts with access to Nexora, their roles, permissions and branches.",
      steps: ["\"Invite\" sends an email invitation (valid for 7 days).", "The key opens access: roles (also temporary, with an end date), permission overrides and branch restriction.", "Disabling revokes access immediately and frees the seat."],
      tips: ["When the user limit is reached you cannot invite, but existing accounts keep working."],
    },
  },
  "/app/roles": {
    pt: {
      title: "Funções e permissões",
      intro: "Funções predefinidas e personalizadas, com permissões granulares validadas no servidor.",
      steps: ["\"Nova função\" cria uma função com as permissões escolhidas.", "O lápis edita; as funções predefinidas também podem ser ajustadas."],
      tips: ["Permissões de módulos não contratados não têm efeito.", "Permissões administrativas só valem para administradores."],
    },
    en: {
      title: "Roles & permissions",
      intro: "Built-in and custom roles, with granular permissions enforced on the server.",
      steps: ["\"New role\" creates a role with the chosen permissions.", "The pencil edits; built-in roles can be adjusted too."],
      tips: ["Permissions for modules that are not contracted have no effect.", "Administrative permissions only apply to administrators."],
    },
  },
  "/app/billing": {
    pt: {
      title: "Subscrição e faturação",
      intro: "Plano, módulos, capacidade, faturas e pagamentos.",
      steps: ["Altere o plano ou os módulos: a pré-visualização mostra o valor proporcional antes de confirmar.", "Pague uma fatura em aberto pelo método disponível.", "Pode agendar o cancelamento para o fim do período pago e revertê-lo antes disso."],
      tips: ["Atraso de pagamento: dias 1–3 acesso normal, 4–8 só leitura, a partir do 9.º suspensão; os dados ficam preservados.", "Os pagamentos reais (ex.: Multicaixa Express) ainda não estão integrados."],
    },
    en: {
      title: "Subscription & billing",
      intro: "Plan, modules, capacity, invoices and payments.",
      steps: ["Change plan or modules: the preview shows the prorated amount before you confirm.", "Pay an open invoice with the available method.", "You can schedule cancellation for the end of the paid period and revert it before then."],
      tips: ["Late payment: days 1–3 normal access, 4–8 read-only, from day 9 suspended; data is preserved.", "Real payments (e.g. Multicaixa Express) are not integrated yet."],
    },
  },
  "/app/settings": {
    pt: {
      title: "Definições da empresa",
      intro: "Dados da empresa, segurança, alertas, unidades, titularidade e acesso de suporte.",
      steps: ["Segurança: exigir 2FA, sessão inativa, dispositivos por utilizador, prazo da lixeira e idioma por omissão.", "Alertas inteligentes: tipos, limiares, e-mail para críticos, escalonamento aos administradores e destinatários por função.", "Unidades e filiais: crie e desative unidades.", "Suporte Nexora: autorize acesso temporário, com motivo, âmbito e duração."],
      tips: ["A transferência da administração principal exige confirmação de quem a recebe."],
    },
    en: {
      title: "Company settings",
      intro: "Company details, security, alerts, branches, ownership and support access.",
      steps: ["Security: require 2FA, idle session timeout, devices per user, trash period and default language.", "Smart alerts: types, thresholds, email for critical alerts, escalation to administrators and recipients by role.", "Branches: create and deactivate branches.", "Nexora support: grant temporary access with a reason, scope and duration."],
      tips: ["Transferring primary administration requires confirmation by the recipient."],
    },
  },
  "/app/ai": {
    pt: {
      title: "Assistente IA",
      intro: "Assistente com as suas permissões e as políticas da empresa. Ações sensíveis exigem aprovação humana.",
      steps: ["Escreva ou dite uma pergunta, ou use uma sugestão (resumo, stock baixo, previsões, simulação de preço).", "Aprovações: ações propostas pela IA aguardam aprovação de outra pessoa.", "Créditos e consumo: saldo, histórico e previsão de esgotamento.", "Políticas de IA (administradores): acesso aos dados, autonomia, módulos, alertas e aprendizagem contextual."],
      tips: ["Com a aprendizagem contextual ligada, peça \"recomendações\" baseadas no histórico da empresa.", "Sem créditos, só a IA fica bloqueada; o resto da Nexora continua a funcionar."],
    },
    en: {
      title: "AI assistant",
      intro: "Assistant with your permissions and the company's policies. Sensitive actions need human approval.",
      steps: ["Type or dictate a question, or use a suggestion (overview, low stock, forecasts, price simulation).", "Approvals: actions proposed by the AI wait for someone else's approval.", "Credits & usage: balance, history and depletion forecast.", "AI policies (administrators): data access, autonomy, modules, alerts and contextual learning."],
      tips: ["With contextual learning on, ask for \"recommendations\" based on the company's history.", "Without credits only the AI is blocked; the rest of Nexora keeps working."],
    },
  },
  "/app/audit": {
    pt: {
      title: "Auditoria",
      intro: "Registo das ações relevantes de utilizadores, sistema, IA e suporte Nexora, encadeado por hash.",
      steps: ["Filtre por origem ou pesquise.", "\"Cadeia íntegra\" confirma que nenhum registo foi alterado ou apagado."],
      tips: ["Os registos não podem ser editados nem apagados."],
    },
    en: {
      title: "Audit log",
      intro: "Record of relevant actions by users, the system, AI and Nexora support, hash-chained.",
      steps: ["Filter by source or search.", "\"Chain intact\" confirms no record was altered or deleted."],
      tips: ["Records cannot be edited or deleted."],
    },
  },
  "/app/exports": {
    pt: {
      title: "Exportar dados",
      intro: "Exportação em formatos abertos (CSV, JSON, XLSX, PDF), respeitando as suas permissões.",
      steps: ["Escolha os conjuntos de dados e o formato.", "Descarregue o ficheiro pelo link (de validade limitada)."],
      tips: ["Cada exportação fica registada na auditoria.", "Após o cancelamento, a exportação continua disponível durante o período de retenção."],
    },
    en: {
      title: "Export data",
      intro: "Export in open formats (CSV, JSON, XLSX, PDF), respecting your permissions.",
      steps: ["Choose the datasets and the format.", "Download the file from the link (valid for a limited time)."],
      tips: ["Every export is recorded in the audit log.", "After cancellation, export remains available during the retention period."],
    },
  },
  "/app/trash": {
    pt: {
      title: "Lixeira",
      intro: "Registos eliminados, recuperáveis durante o prazo configurado.",
      steps: ["\"Restaurar\" devolve o registo ao seu lugar."],
      tips: ["Após o prazo, a eliminação é definitiva, exceto registos financeiros com obrigação legal ou sob retenção legal."],
    },
    en: {
      title: "Trash",
      intro: "Deleted records, recoverable during the configured period.",
      steps: ["\"Restore\" puts the record back."],
      tips: ["After the period, deletion is permanent, except financial records under legal obligation or legal hold."],
    },
  },
  "/app/notifications": {
    pt: {
      title: "Notificações",
      intro: "Alertas do sistema e da IA, no idioma escolhido.",
      steps: ["Marque como lidas; abra a ligação para ir ao sítio certo.", "\"As minhas preferências\": silenciar tipos, e-mail e horário de silêncio."],
      tips: ["Segurança, faturação, incidentes e escalonamentos não podem ser silenciados."],
    },
    en: {
      title: "Notifications",
      intro: "System and AI alerts, in your chosen language.",
      steps: ["Mark as read; open the link to go to the right place.", "\"My preferences\": mute types, email and quiet hours."],
      tips: ["Security, billing, incidents and escalations cannot be muted."],
    },
  },
  "/app/security": {
    pt: {
      title: "Segurança da conta",
      intro: "Palavra-passe, autenticação de dois fatores e sessões ativas.",
      steps: ["Ative o 2FA com uma aplicação autenticadora (Google ou Microsoft Authenticator) e guarde os códigos de recuperação.", "Termine sessões em dispositivos que não reconhece.", "Altere a palavra-passe: as outras sessões são terminadas."],
      tips: ["É avisado quando há acesso a partir de um novo dispositivo."],
    },
    en: {
      title: "Account security",
      intro: "Password, two-factor authentication and active sessions.",
      steps: ["Turn on 2FA with an authenticator app (Google or Microsoft Authenticator) and keep the recovery codes.", "End sessions on devices you do not recognise.", "Change your password: other sessions are ended."],
      tips: ["You are notified when there is a sign-in from a new device."],
    },
  },
};

/** Entrada de ajuda para um caminho (ignora a query string); null se não houver. */
export function helpFor(pathname: string, lang: "pt" | "en"): HelpEntry | null {
  const path = pathname.replace(/\/+$/, "") || "/app";
  return HELP[path]?.[lang] ?? null;
}
