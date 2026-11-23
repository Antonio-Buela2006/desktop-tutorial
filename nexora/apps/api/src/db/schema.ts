/**
 * Nexora — modelo de dados multi-tenant (PostgreSQL / Drizzle).
 *
 * Regra de ouro: todos os registos de negócio têm `tenant_id` e todas as
 * consultas de negócio passam pelo contexto de tenant obtido da sessão
 * autenticada (ver src/core/tenant.ts). Nunca se confia num tenant_id do cliente.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  bigserial,
  date,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });

/* ------------------------------------------------------------------ */
/* Plataforma (configuração comercial gerida pela equipa Nexora)       */
/* ------------------------------------------------------------------ */

export const plans = pgTable("plans", {
  id: id(),
  code: text("code").notNull().unique(), // starter | professional | enterprise
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  currency: text("currency").notNull().default("AOA"),
  // PENDENTE: preços e limites não estão aprovados. null = "a definir".
  priceMonthly: money("price_monthly"),
  priceYearly: money("price_yearly"),
  maxEmployees: integer("max_employees"),
  maxUsers: integer("max_users"),
  maxSecondaryAdmins: integer("max_secondary_admins"),
  includedModules: integer("included_modules"),
  aiCreditsMonthly: integer("ai_credits_monthly"),
  extraUserPrice: money("extra_user_price"),
  extraModulePrice: money("extra_module_price"),
  // false enquanto o proprietário do produto não validar os valores comerciais
  commercialConfirmed: boolean("commercial_confirmed").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const moduleCatalog = pgTable("module_catalog", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  // active = contratável; pending = nome/âmbito por validar (não contratável); inactive = retirado
  status: text("status").notNull().default("pending"),
  // true = nome de trabalho que exige validação do proprietário do produto
  provisional: boolean("provisional").notNull().default(true),
  implemented: boolean("implemented").notNull().default(false),
  priceMonthly: money("price_monthly"),
  dependsOn: text("depends_on").array().notNull().default([]),
  minPlan: text("min_plan"),
  permissions: text("permissions").array().notNull().default([]),
  navPath: text("nav_path"),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Parâmetros globais (custos de IA, retenção, etc.) — chave/valor versionado via auditoria. */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const platformAdmins = pgTable("platform_admins", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  // owner | billing | support | readonly
  role: text("role").notNull().default("readonly"),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const platformSessions = pgTable("platform_sessions", {
  id: id(),
  adminId: uuid("admin_id").notNull().references(() => platformAdmins.id),
  tokenHash: text("token_hash").notNull().unique(),
  mfaVerified: boolean("mfa_verified").notNull().default(false),
  createdAt: createdAt(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
});

/* ------------------------------------------------------------------ */
/* Identidade e tenants                                                */
/* ------------------------------------------------------------------ */

export type AlertSettings = {
  lowStock: boolean;
  abnormalExpense: boolean;
  abnormalExpenseMultiplier: number; // despesa > N × média dos últimos 90 dias
  salesDrop: boolean;
  salesDropPct: number; // queda do mês vs média dos 3 anteriores (projeção)
  emailCritical: boolean; // enviar também por e-mail os alertas críticos
};

export type TenantSettings = {
  alerts?: AlertSettings;
  /** Preenchido quando os dados de negócio foram eliminados por fim do prazo de retenção. */
  dataPurgedAt?: string;
  require2fa: "off" | "admins" | "all";
  idleTimeoutMinutes: number;
  maxSessionsPerUser: number;
  languages: string[];
  dateLocale: string;
  trashRetentionDays: number;
  legalHold: boolean;
};

export const tenants = pgTable("tenants", {
  id: id(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  taxId: text("tax_id"),
  country: text("country").notNull().default("AO"),
  currency: text("currency").notNull().default("AOA"),
  defaultLocale: text("default_locale").notNull().default("pt"),
  isDemo: boolean("is_demo").notNull().default(false),
  settings: jsonb("settings").$type<TenantSettings>().notNull(),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  locale: text("locale").notNull().default("pt"),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  recoveryCodes: text("recovery_codes").array().notNull().default([]),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: ts("locked_until"),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    // primary_admin | secondary_admin | member
    level: text("level").notNull().default("member"),
    // active | disabled
    status: text("status").notNull().default("active"),
    employeeId: uuid("employee_id"),
    // Âmbito por unidade: vazio = todas as unidades; caso contrário só vê/cria dados destas unidades
    branchIds: uuid("branch_ids").array().notNull().default([]),
    createdAt: createdAt(),
    disabledAt: ts("disabled_at"),
  },
  (t) => [uniqueIndex("memberships_tenant_user").on(t.tenantId, t.userId), index("memberships_tenant").on(t.tenantId)],
);

export const roles = pgTable(
  "roles",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isSystem: boolean("is_system").notNull().default(false),
    permissions: text("permissions").array().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("roles_tenant_code").on(t.tenantId, t.code)],
);

export const membershipRoles = pgTable(
  "membership_roles",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    membershipId: uuid("membership_id").notNull().references(() => memberships.id),
    roleId: uuid("role_id").notNull().references(() => roles.id),
    validFrom: ts("valid_from"),
    validUntil: ts("valid_until"),
  },
  (t) => [primaryKey({ columns: [t.membershipId, t.roleId] })],
);

export const permissionOverrides = pgTable("permission_overrides", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  membershipId: uuid("membership_id").notNull().references(() => memberships.id),
  permission: text("permission").notNull(),
  effect: text("effect").notNull(), // grant | deny
  validFrom: ts("valid_from"),
  validUntil: ts("valid_until"),
  reason: text("reason"),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    membershipId: uuid("membership_id").notNull().references(() => memberships.id),
    mfaVerified: boolean("mfa_verified").notNull().default(false),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

export const invitations = pgTable("invitations", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull(),
  name: text("name").notNull(),
  roleIds: uuid("role_ids").array().notNull().default([]),
  level: text("level").notNull().default("member"),
  employeeId: uuid("employee_id"),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: uuid("invited_by").notNull(),
  expiresAt: ts("expires_at").notNull(),
  acceptedAt: ts("accepted_at"),
  revokedAt: ts("revoked_at"),
  createdAt: createdAt(),
});

export const passwordResets = pgTable("password_resets", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
});

export const adminTransfers = pgTable("admin_transfers", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  fromMembershipId: uuid("from_membership_id").notNull(),
  toMembershipId: uuid("to_membership_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | canceled | expired
  expiresAt: ts("expires_at").notNull(),
  decidedAt: ts("decided_at"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Subscrição, módulos e faturação                                     */
/* ------------------------------------------------------------------ */

export const subscriptions = pgTable("subscriptions", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().unique().references(() => tenants.id),
  planId: uuid("plan_id").notNull().references(() => plans.id),
  // trial | pending_payment | active | canceled | expired
  // (tolerância / somente leitura / suspensa são derivadas do atraso — ver core/subscription.ts)
  status: text("status").notNull(),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  trialEndsAt: ts("trial_ends_at"),
  currentPeriodStart: ts("current_period_start"),
  currentPeriodEnd: ts("current_period_end"),
  activatedAt: ts("activated_at"),
  moduleSwapWindowEndsAt: ts("module_swap_window_ends_at"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  canceledAt: ts("canceled_at"),
  extraUsers: integer("extra_users").notNull().default(0),
  extraEmployees: integer("extra_employees").notNull().default(0),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const tenantModules = pgTable(
  "tenant_modules",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    moduleCode: text("module_code").notNull().references(() => moduleCatalog.code),
    status: text("status").notNull().default("active"), // active | inactive
    source: text("source").notNull().default("included"), // included | addon | trial
    activatedAt: ts("activated_at").notNull().defaultNow(),
    deactivatedAt: ts("deactivated_at"),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.moduleCode] })],
);

export type InvoiceLine = { description: string; quantity: number; unitPrice: number; total: number };

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    number: text("number").notNull().unique(),
    // draft | issued | paid | partially_paid | void | refunded  (vencida = derivado de due_at)
    status: text("status").notNull().default("issued"),
    kind: text("kind").notNull().default("subscription"), // subscription | adjustment | addon | credit_note
    currency: text("currency").notNull().default("AOA"),
    lines: jsonb("lines").$type<InvoiceLine[]>().notNull().default([]),
    subtotal: money("subtotal").notNull(),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
    tax: money("tax").notNull().default(0),
    total: money("total").notNull(),
    amountPaid: money("amount_paid").notNull().default(0),
    issuedAt: ts("issued_at").notNull().defaultNow(),
    dueAt: ts("due_at").notNull(),
    paidAt: ts("paid_at"),
    periodStart: ts("period_start"),
    periodEnd: ts("period_end"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("invoices_tenant").on(t.tenantId)],
);

export const payments = pgTable("payments", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  provider: text("provider").notNull(), // sandbox | bank_transfer | multicaixa_express
  providerRef: text("provider_ref").unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  amount: money("amount").notNull(),
  // pending | confirmed | failed | refunded
  status: text("status").notNull().default("pending"),
  checkoutToken: text("checkout_token"),
  reconciledBy: uuid("reconciled_by"),
  createdAt: createdAt(),
  confirmedAt: ts("confirmed_at"),
});

export const webhookEvents = pgTable("webhook_events", {
  id: id(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
  result: text("result"),
}, (t) => [uniqueIndex("webhook_provider_event").on(t.provider, t.eventId)]);

/* ------------------------------------------------------------------ */
/* Auditoria, notificações, exportação, suporte                        */
/* ------------------------------------------------------------------ */

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id"),
    actorType: text("actor_type").notNull(), // user | platform_admin | system | ai
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    traceId: text("trace_id"),
    createdAt: createdAt(),
    prevHash: text("prev_hash"),
    hash: text("hash").notNull(),
  },
  (t) => [index("audit_tenant_created").on(t.tenantId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    membershipId: uuid("membership_id").notNull().references(() => memberships.id),
    type: text("type").notNull(),
    severity: text("severity").notNull().default("info"), // info | warning | critical
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    dedupeKey: text("dedupe_key"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_member").on(t.membershipId), uniqueIndex("notifications_dedupe").on(t.membershipId, t.dedupeKey)],
);

export const exportJobs = pgTable("export_jobs", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  requestedBy: uuid("requested_by").notNull(),
  scope: text("scope").notNull(),
  format: text("format").notNull(),
  datasets: text("datasets").array().notNull().default([]),
  status: text("status").notNull().default("ready"),
  tokenHash: text("token_hash").notNull().unique(),
  content: text("content").notNull(),
  contentType: text("content_type").notNull(),
  // utf8 para CSV/JSON; base64 para formatos binários (XLSX/PDF)
  encoding: text("encoding").notNull().default("utf8"),
  fileName: text("file_name").notNull(),
  expiresAt: ts("expires_at").notNull(),
  downloadedAt: ts("downloaded_at"),
  createdAt: createdAt(),
});

/** Ficheiros privados (documentos de funcionários, clientes…). Chave de armazenamento prefixada pelo tenant. */
export const fileAssets = pgTable(
  "file_assets",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    entityType: text("entity_type").notNull(), // employee | customer
    entityId: uuid("entity_id").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull(),
    category: text("category"),
    uploadedBy: uuid("uploaded_by").notNull(),
    createdAt: createdAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("file_assets_entity").on(t.tenantId, t.entityType, t.entityId)],
);

export const supportAccessGrants = pgTable("support_access_grants", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  platformAdminEmail: text("platform_admin_email").notNull(),
  reason: text("reason").notNull(),
  scope: text("scope").array().notNull().default([]),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  approvedBy: uuid("approved_by").notNull(),
  revokedAt: ts("revoked_at"),
  breakGlass: boolean("break_glass").notNull().default(false),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Inteligência Artificial                                             */
/* ------------------------------------------------------------------ */

export const aiPolicies = pgTable("ai_policies", {
  tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id),
  enabled: boolean("enabled").notNull().default(true),
  // restricted | custom | general
  accessLevel: text("access_level").notNull().default("custom"),
  allowedModules: text("allowed_modules").array().notNull().default([]),
  // suggest_only | simple_auto
  autonomy: text("autonomy").notNull().default("simple_auto"),
  dualApprovalFinancial: boolean("dual_approval_financial").notNull().default(false),
  disabledModules: text("disabled_modules").array().notNull().default([]),
  delegatedTo: uuid("delegated_to").array().notNull().default([]),
  languages: text("languages").array().notNull().default(["pt", "en"]),
  alertsEnabled: boolean("alerts_enabled").notNull().default(true),
  learningEnabled: boolean("learning_enabled").notNull().default(false),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const aiWallets = pgTable("ai_wallets", {
  tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id),
  balance: integer("balance").notNull().default(0),
  monthlyAllowance: integer("monthly_allowance").notNull().default(0),
  periodStart: ts("period_start").notNull().defaultNow(),
});

export const aiCreditTransactions = pgTable("ai_credit_transactions", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  membershipId: uuid("membership_id"),
  amount: integer("amount").notNull(), // negativo = consumo
  operation: text("operation").notNull(),
  module: text("module"),
  provider: text("provider"),
  model: text("model"),
  reason: text("reason"),
  createdAt: createdAt(),
});

export const aiRequests = pgTable("ai_requests", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  membershipId: uuid("membership_id").notNull(),
  prompt: text("prompt").notNull(),
  response: text("response").notNull().default(""),
  toolCalls: jsonb("tool_calls").$type<unknown[]>().notNull().default([]),
  contextRefs: jsonb("context_refs").$type<string[]>().notNull().default([]),
  provider: text("provider").notNull(),
  model: text("model"),
  credits: integer("credits").notNull().default(0),
  status: text("status").notNull().default("ok"),
  createdAt: createdAt(),
});

export const aiActions = pgTable("ai_actions", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  requestId: uuid("request_id"),
  requestedBy: uuid("requested_by").notNull(),
  tool: text("tool").notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().notNull(),
  preview: jsonb("preview").$type<Record<string, unknown>>().notNull(),
  sensitivity: text("sensitivity").notNull(), // simple | sensitive
  // pending | approved | rejected | executed | failed | canceled
  status: text("status").notNull().default("pending"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  approvals: jsonb("approvals").$type<{ membershipId: string; at: string }[]>().notNull().default([]),
  requiredApprovals: integer("required_approvals").notNull().default(1),
  decidedBy: uuid("decided_by"),
  decidedAt: ts("decided_at"),
  executedAt: ts("executed_at"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Módulos de negócio (nomes provisórios — ver docs/product/pending.md) */
/* ------------------------------------------------------------------ */

export const branches = pgTable(
  "branches",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    address: text("address"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("branches_tenant_code").on(t.tenantId, t.code)],
);

/** Preferências de notificação por utilizador (alertas de segurança e faturação críticos não podem ser silenciados). */
export const notificationPreferences = pgTable("notification_preferences", {
  membershipId: uuid("membership_id").primaryKey().references(() => memberships.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  mutedTypes: text("muted_types").array().notNull().default([]),
  quietStartHour: integer("quiet_start_hour"),
  quietEndHour: integer("quiet_end_hour"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const employees = pgTable(
  "employees",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    fullName: text("full_name").notNull(),
    email: text("email"),
    jobTitle: text("job_title"),
    department: text("department"),
    branchId: uuid("branch_id"),
    hireDate: date("hire_date"),
    exitDate: date("exit_date"),
    status: text("status").notNull().default("active"), // active | exited
    salary: money("salary"), // dado sensível — permissão employees.view_salary
    anonymizedAt: ts("anonymized_at"),
    createdAt: createdAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("employees_tenant").on(t.tenantId)],
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    taxId: text("tax_id"),
    notes: text("notes"),
    createdAt: createdAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("customers_tenant").on(t.tenantId)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    unitPrice: money("unit_price").notNull(),
    unitCost: money("unit_cost").notNull().default(0),
    stockQty: integer("stock_qty").notNull().default(0),
    reorderLevel: integer("reorder_level").notNull().default(0),
    createdAt: createdAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [uniqueIndex("products_tenant_sku").on(t.tenantId, t.sku)],
);

/**
 * Stock por unidade. products.stock_qty mantém sempre o TOTAL da empresa;
 * o armazém central = total − soma das unidades.
 */
export const stockLevels = pgTable(
  "stock_levels",
  {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    productId: uuid("product_id").notNull().references(() => products.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    qty: integer("qty").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.branchId] }), index("stock_levels_tenant").on(t.tenantId)],
);

export const stockMovements = pgTable("stock_movements", {
  id: id(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  branchId: uuid("branch_id"), // null = armazém central
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  refType: text("ref_type"),
  refId: uuid("ref_id"),
  createdBy: uuid("created_by"),
  createdAt: createdAt(),
});

export type SaleLine = { productId: string; name: string; quantity: number; unitPrice: number; total: number };

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    number: text("number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    branchId: uuid("branch_id"),
    lines: jsonb("lines").$type<SaleLine[]>().notNull(),
    total: money("total").notNull(),
    status: text("status").notNull().default("confirmed"), // confirmed | canceled
    soldAt: ts("sold_at").notNull().defaultNow(),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("sales_tenant_sold").on(t.tenantId, t.soldAt)],
);

export const financeTransactions = pgTable(
  "finance_transactions",
  {
    id: id(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    kind: text("kind").notNull(), // income | expense
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    amount: money("amount").notNull(),
    occurredOn: date("occurred_on").notNull(),
    branchId: uuid("branch_id"),
    // pending_approval | approved | rejected
    status: text("status").notNull().default("approved"),
    createdBy: uuid("created_by"),
    approvedBy: uuid("approved_by"),
    createdAt: createdAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("finance_tenant_date").on(t.tenantId, t.occurredOn)],
);

/** Incidentes operacionais geridos pela equipa Nexora (§7.1, §16.3). */
export type IncidentUpdate = { at: string; by: string; status: string; note: string };
export const incidents = pgTable("incidents", {
  id: id(),
  title: text("title").notNull(),
  severity: text("severity").notNull(), // low | medium | high | critical
  status: text("status").notNull().default("investigating"), // investigating | identified | monitoring | resolved
  description: text("description").notNull().default(""),
  affectedTenants: uuid("affected_tenants").array().notNull().default([]),
  allTenants: boolean("all_tenants").notNull().default(false),
  updates: jsonb("updates").$type<IncidentUpdate[]>().notNull().default([]),
  createdBy: uuid("created_by").notNull(),
  createdAt: createdAt(),
  resolvedAt: ts("resolved_at"),
});
