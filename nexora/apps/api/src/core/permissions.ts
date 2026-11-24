/**
 * Catálogo de permissões granulares (RBAC) — formato "<recurso>.<ação>".
 *
 * Permissões cujo recurso pertence a um módulo comercial (crm, inventory, sales,
 * finance) só são efetivas se o módulo estiver contratado e ativo no tenant.
 */

export type PermissionDef = { key: string; label: string; module?: string; write: boolean };

const p = (key: string, label: string, write: boolean, module?: string): PermissionDef => ({ key, label, write, module });

/** Nomes das permissões em inglês (o catálogo abaixo está em português). */
export const PERMISSION_LABELS_EN: Record<string, string> = {
  "dashboard.view": "View dashboard",
  "users.view": "View users",
  "users.invite": "Invite users",
  "users.edit": "Edit users and assigned roles",
  "users.disable": "Disable users",
  "roles.view": "View roles",
  "roles.manage": "Create and edit roles and permissions",
  "employees.view": "View employees",
  "employees.create": "Add employees",
  "employees.edit": "Edit employees",
  "employees.delete": "Delete employees",
  "employees.offboard": "Record employee departures",
  "employees.view_salary": "View salaries (sensitive data)",
  "employees.export": "Export employees",
  "billing.view": "View subscription and invoices",
  "billing.manage": "Change plan, modules and pay",
  "settings.manage": "Configure company and security",
  "audit.view": "View audit log",
  "trash.manage": "Restore deleted records",
  "support.grant": "Authorize temporary support access",
  "ai.use": "Use the AI assistant",
  "ai.configure": "Configure AI policies",
  "ai.approve": "Approve actions proposed by the AI",
  "reports.view": "View reports and forecasts",
  "crm.view": "View customers",
  "crm.create": "Create customers",
  "crm.edit": "Edit customers",
  "crm.delete": "Delete customers",
  "crm.export": "Export customers",
  "inventory.view": "View products and stock",
  "inventory.create": "Create products",
  "inventory.edit": "Edit products",
  "inventory.delete": "Delete products",
  "inventory.adjust": "Adjust stock",
  "inventory.approve_transfer": "Approve stock transfers",
  "inventory.export": "Export stock",
  "sales.view": "View sales",
  "sales.create": "Record sales",
  "sales.cancel": "Cancel sales",
  "sales.export": "Export sales",
  "finance.view": "View financial transactions",
  "finance.create": "Record transactions",
  "finance.edit": "Edit transactions",
  "finance.delete": "Delete transactions",
  "finance.approve": "Approve financial transactions",
  "finance.export": "Export transactions",
};

export const permissionLabel = (key: string, locale: string) => (locale === "en" ? PERMISSION_LABELS_EN[key] : undefined) ?? PERMISSIONS.find((x) => x.key === key)?.label ?? key;

export const PERMISSIONS: PermissionDef[] = [
  // Núcleo da plataforma
  p("dashboard.view", "Ver dashboard", false),
  p("users.view", "Ver utilizadores", false),
  p("users.invite", "Convidar utilizadores", true),
  p("users.edit", "Editar utilizadores e funções atribuídas", true),
  p("users.disable", "Desativar utilizadores", true),
  p("roles.view", "Ver funções", false),
  p("roles.manage", "Criar e editar funções e permissões", true),
  p("employees.view", "Ver funcionários", false),
  p("employees.create", "Registar funcionários", true),
  p("employees.edit", "Editar funcionários", true),
  p("employees.delete", "Eliminar funcionários", true),
  p("employees.offboard", "Registar saída de funcionários", true),
  p("employees.view_salary", "Ver salários (dado sensível)", false),
  p("employees.export", "Exportar funcionários", false),
  p("billing.view", "Ver subscrição e faturas", false),
  p("billing.manage", "Alterar plano, módulos e pagar", true),
  p("settings.manage", "Configurar empresa e segurança", true),
  p("audit.view", "Consultar auditoria", false),
  p("trash.manage", "Restaurar registos eliminados", true),
  p("support.grant", "Autorizar acesso temporário de suporte", true),
  p("ai.use", "Utilizar o assistente de IA", false),
  p("ai.configure", "Configurar políticas de IA", true),
  p("ai.approve", "Aprovar ações propostas pela IA", true),
  p("reports.view", "Consultar relatórios e previsões", false),
  // Módulo CRM / Clientes
  p("crm.view", "Ver clientes", false, "crm"),
  p("crm.create", "Criar clientes", true, "crm"),
  p("crm.edit", "Editar clientes", true, "crm"),
  p("crm.delete", "Eliminar clientes", true, "crm"),
  p("crm.export", "Exportar clientes", false, "crm"),
  // Módulo Stock
  p("inventory.view", "Ver produtos e stock", false, "inventory"),
  p("inventory.create", "Criar produtos", true, "inventory"),
  p("inventory.edit", "Editar produtos", true, "inventory"),
  p("inventory.delete", "Eliminar produtos", true, "inventory"),
  p("inventory.adjust", "Ajustar stock", true, "inventory"),
  p("inventory.approve_transfer", "Aprovar transferências de stock", true, "inventory"),
  p("inventory.export", "Exportar stock", false, "inventory"),
  // Módulo Vendas
  p("sales.view", "Ver vendas", false, "sales"),
  p("sales.create", "Registar vendas", true, "sales"),
  p("sales.cancel", "Anular vendas", true, "sales"),
  p("sales.export", "Exportar vendas", false, "sales"),
  // Módulo Finanças
  p("finance.view", "Ver movimentos financeiros", false, "finance"),
  p("finance.create", "Registar movimentos", true, "finance"),
  p("finance.edit", "Editar movimentos", true, "finance"),
  p("finance.delete", "Eliminar movimentos", true, "finance"),
  p("finance.approve", "Aprovar movimentos financeiros", true, "finance"),
  p("finance.export", "Exportar movimentos", false, "finance"),
];

export const PERMISSION_KEYS = new Set(PERMISSIONS.map((x) => x.key));
export const permissionDef = (key: string) => PERMISSIONS.find((x) => x.key === key);

/** Permissões que só administradores (principal ou secundários com delegação) podem receber. */
export const ADMIN_ONLY = new Set(["roles.manage", "settings.manage", "support.grant", "ai.configure", "billing.manage"]);

const all = (prefix: string) => PERMISSIONS.filter((x) => x.key.startsWith(prefix + ".")).map((x) => x.key);

/** Funções predefinidas (exemplos da especificação §8.1). Editáveis por tenant; as de sistema não podem ser apagadas. */
export const SYSTEM_ROLES: { code: string; name: string; description: string; permissions: string[] }[] = [
  {
    code: "administrador",
    name: "Administrador",
    description: "Administração da empresa (atribuída a administradores secundários).",
    permissions: [
      "dashboard.view", ...all("users"), "roles.view", "roles.manage", "billing.view", "settings.manage",
      "audit.view", "trash.manage", "ai.use", "ai.approve", "reports.view", "employees.view",
    ],
  },
  {
    code: "diretor_geral",
    name: "Diretor-geral",
    description: "Visão global e aprovações.",
    permissions: [
      "dashboard.view", "users.view", "roles.view", "employees.view", "billing.view", "audit.view", "reports.view",
      "ai.use", "ai.approve", ...all("crm"), ...all("inventory"), ...all("sales"), ...all("finance"),
    ],
  },
  {
    code: "gestor_rh",
    name: "Gestor de RH",
    description: "Cadastro de funcionários e saídas.",
    permissions: ["dashboard.view", ...all("employees"), "users.view", "ai.use", "reports.view"],
  },
  {
    code: "contabilista",
    name: "Contabilista",
    description: "Registo e consulta financeira; sem aprovação.",
    permissions: ["dashboard.view", "finance.view", "finance.create", "finance.edit", "finance.export", "sales.view", "reports.view", "ai.use"],
  },
  {
    code: "gestor_financeiro",
    name: "Gestor financeiro",
    description: "Finanças completas, incluindo aprovações.",
    permissions: ["dashboard.view", ...all("finance"), "sales.view", "billing.view", "reports.view", "ai.use", "ai.approve"],
  },
  {
    code: "gestor_stock",
    name: "Gestor de stock",
    description: "Produtos, stock e ajustes.",
    permissions: ["dashboard.view", ...all("inventory"), "sales.view", "reports.view", "ai.use", "ai.approve"],
  },
  {
    code: "comercial",
    name: "Comercial",
    description: "Clientes e vendas.",
    permissions: ["dashboard.view", ...all("crm"), "sales.view", "sales.create", "sales.export", "inventory.view", "reports.view", "ai.use"],
  },
  {
    code: "vendedor",
    name: "Vendedor",
    description: "Registo de vendas e clientes.",
    permissions: ["dashboard.view", "crm.view", "crm.create", "sales.view", "sales.create", "inventory.view", "ai.use"],
  },
  {
    code: "funcionario",
    name: "Funcionário",
    description: "Acesso mínimo (menor privilégio).",
    permissions: ["dashboard.view", "ai.use"],
  },
];

/** Ferramentas/tabelas de cada módulo comercial implementado — usado por exportação, pesquisa e IA. */
export const MODULE_DATASETS: Record<string, { dataset: string; viewPerm: string; exportPerm: string }[]> = {
  crm: [{ dataset: "customers", viewPerm: "crm.view", exportPerm: "crm.export" }],
  inventory: [
    { dataset: "products", viewPerm: "inventory.view", exportPerm: "inventory.export" },
    { dataset: "stock_movements", viewPerm: "inventory.view", exportPerm: "inventory.export" },
  ],
  sales: [{ dataset: "sales_orders", viewPerm: "sales.view", exportPerm: "sales.export" }],
  finance: [{ dataset: "finance_transactions", viewPerm: "finance.view", exportPerm: "finance.export" }],
  core: [{ dataset: "employees", viewPerm: "employees.view", exportPerm: "employees.export" }],
};
