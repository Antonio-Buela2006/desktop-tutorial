import { boolean, date, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const businessRoleEnum = mysqlEnum("businessRole", ["administrador", "gestor", "contabilista", "rh", "comercial", "logistica", "funcionario"]);
export const entryStatusEnum = mysqlEnum("entryStatus", ["rascunho", "pendente", "pago", "vencido", "cancelado", "concluido"]);

const auditColumns = {
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
};

export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  taxNumber: varchar("taxNumber", { length: 64 }),
  sector: varchar("sector", { length: 120 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  currency: varchar("currency", { length: 8 }).notNull().default("AOA"),
  willyScheduleCronTaskUid: varchar("willyScheduleCronTaskUid", { length: 65 }),
  createdBy: int("createdBy").notNull().references(() => users.id),
  ...auditColumns,
}, table => [uniqueIndex("companies_tax_number_unique").on(table.taxNumber)]);

export const memberships = mysqlTable("memberships", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: businessRoleEnum.notNull().default("funcionario"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("membership_company_user_unique").on(table.companyId, table.userId), index("membership_user_idx").on(table.userId)]);

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  managerId: int("managerId").references(() => users.id),
  ...auditColumns,
}, table => [index("department_company_idx").on(table.companyId)]);

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  taxNumber: varchar("taxNumber", { length: 64 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  address: text("address"),
  notes: text("notes"),
  ...auditColumns,
}, table => [index("customer_company_idx").on(table.companyId)]);

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  taxNumber: varchar("taxNumber", { length: 64 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 40 }),
  address: text("address"),
  ...auditColumns,
}, table => [index("supplier_company_idx").on(table.companyId)]);

export const warehouses = mysqlTable("warehouses", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  location: varchar("location", { length: 240 }),
  active: boolean("active").notNull().default(true),
  ...auditColumns,
}, table => [index("warehouse_company_idx").on(table.companyId)]);

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  sku: varchar("sku", { length: 80 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  salePrice: decimal("salePrice", { precision: 14, scale: 2 }).notNull().default("0.00"),
  costPrice: decimal("costPrice", { precision: 14, scale: 2 }).notNull().default("0.00"),
  active: boolean("active").notNull().default(true),
  ...auditColumns,
}, table => [uniqueIndex("product_company_sku_unique").on(table.companyId, table.sku), index("product_company_idx").on(table.companyId)]);

export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  warehouseId: int("warehouseId").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull().default(0),
  reservedQuantity: int("reservedQuantity").notNull().default(0),
  minimumQuantity: int("minimumQuantity").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("inventory_product_warehouse_unique").on(table.productId, table.warehouseId), index("inventory_company_idx").on(table.companyId)]);

export const stockMovements = mysqlTable("stockMovements", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  inventoryId: int("inventoryId").notNull().references(() => inventory.id, { onDelete: "cascade" }),
  type: mysqlEnum("stockMovementType", ["entrada", "saida", "ajuste", "reserva"]).notNull(),
  quantity: int("quantity").notNull(),
  reference: varchar("reference", { length: 120 }),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("stock_movement_company_idx").on(table.companyId)]);

export const sales = mysqlTable("sales", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  customerId: int("customerId").notNull().references(() => customers.id),
  code: varchar("code", { length: 64 }).notNull(),
  status: entryStatusEnum.notNull().default("concluido"),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 14, scale: 2 }).notNull(),
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  ...auditColumns,
}, table => [uniqueIndex("sale_company_code_unique").on(table.companyId, table.code), index("sale_company_created_idx").on(table.companyId, table.createdAt)]);

export const saleItems = mysqlTable("saleItems", {
  id: int("id").autoincrement().primaryKey(),
  saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id),
  warehouseId: int("warehouseId").notNull().references(() => warehouses.id),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 2 }).notNull(),
  lineTotal: decimal("lineTotal", { precision: 14, scale: 2 }).notNull(),
});

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 64 }).notNull(),
  status: entryStatusEnum.notNull().default("pendente"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  dueDate: date("dueDate"),
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).notNull(),
  ...auditColumns,
}, table => [uniqueIndex("invoice_company_code_unique").on(table.companyId, table.code), uniqueIndex("invoice_sale_unique").on(table.saleId)]);

export const ledgerEntries = mysqlTable("ledgerEntries", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  saleId: int("saleId").references(() => sales.id, { onDelete: "cascade" }),
  invoiceId: int("invoiceId").references(() => invoices.id, { onDelete: "cascade" }),
  accountCode: varchar("accountCode", { length: 32 }).notNull(),
  accountName: varchar("accountName", { length: 180 }).notNull(),
  debit: decimal("debit", { precision: 14, scale: 2 }).notNull().default("0.00"),
  credit: decimal("credit", { precision: 14, scale: 2 }).notNull().default("0.00"),
  description: varchar("description", { length: 320 }).notNull(),
  postedAt: timestamp("postedAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
}, table => [index("ledger_company_posted_idx").on(table.companyId, table.postedAt)]);

export const financialEntries = mysqlTable("financialEntries", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  saleId: int("saleId").references(() => sales.id, { onDelete: "set null" }),
  type: mysqlEnum("financialEntryType", ["receita", "despesa"]).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  description: varchar("description", { length: 320 }).notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  status: entryStatusEnum.notNull().default("pendente"),
  dueDate: date("dueDate"),
  paidAt: timestamp("paidAt"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  ...auditColumns,
}, table => [index("financial_company_type_idx").on(table.companyId, table.type), index("financial_company_due_idx").on(table.companyId, table.dueDate)]);

export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 180 }).notNull(),
  period: varchar("period", { length: 32 }).notNull(),
  plannedAmount: decimal("plannedAmount", { precision: 14, scale: 2 }).notNull(),
  actualAmount: decimal("actualAmount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  createdBy: int("createdBy").notNull().references(() => users.id),
  ...auditColumns,
}, table => [index("budget_company_idx").on(table.companyId)]);

export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  departmentId: int("departmentId").references(() => departments.id, { onDelete: "set null" }),
  fullName: varchar("fullName", { length: 180 }).notNull(),
  email: varchar("email", { length: 320 }),
  jobTitle: varchar("jobTitle", { length: 120 }),
  hiredAt: date("hiredAt"),
  status: entryStatusEnum.notNull().default("concluido"),
  documentUrl: varchar("documentUrl", { length: 1024 }),
  ...auditColumns,
}, table => [index("employee_company_idx").on(table.companyId)]);

export const attendances = mysqlTable("attendances", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: int("employeeId").notNull().references(() => employees.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  status: mysqlEnum("attendanceStatus", ["presente", "ausente", "justificado", "remoto"]).notNull(),
  notes: varchar("notes", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("attendance_employee_date_unique").on(table.employeeId, table.date)]);

export const leaveRequests = mysqlTable("leaveRequests", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: int("employeeId").notNull().references(() => employees.id, { onDelete: "cascade" }),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  status: entryStatusEnum.notNull().default("pendente"),
  notes: varchar("notes", { length: 320 }),
  approvedBy: int("approvedBy").references(() => users.id, { onDelete: "set null" }),
  ...auditColumns,
}, table => [index("leave_company_idx").on(table.companyId)]);

export const performanceReviews = mysqlTable("performanceReviews", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: int("employeeId").notNull().references(() => employees.id, { onDelete: "cascade" }),
  reviewerId: int("reviewerId").notNull().references(() => users.id),
  score: int("score").notNull(),
  comments: text("comments"),
  reviewedAt: timestamp("reviewedAt").defaultNow().notNull(),
}, table => [index("review_employee_idx").on(table.employeeId)]);

export const deliveries = mysqlTable("deliveries", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  saleId: int("saleId").notNull().references(() => sales.id, { onDelete: "cascade" }),
  status: mysqlEnum("deliveryStatus", ["agendada", "em_transito", "entregue", "atrasada", "cancelada"]).notNull().default("agendada"),
  scheduledAt: timestamp("scheduledAt"),
  deliveredAt: timestamp("deliveredAt"),
  trackingCode: varchar("trackingCode", { length: 80 }),
  address: text("address"),
  notes: text("notes"),
  ...auditColumns,
}, table => [uniqueIndex("delivery_sale_unique").on(table.saleId), index("delivery_company_status_idx").on(table.companyId, table.status)]);

export const willyRecommendations = mysqlTable("willyRecommendations", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  category: mysqlEnum("willyCategory", ["stock", "financeiro", "comercial", "operacional"]).notNull(),
  severity: mysqlEnum("willySeverity", ["informativo", "atencao", "critico"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  recommendation: text("recommendation").notNull(),
  rationale: text("rationale").notNull(),
  confidence: int("confidence").notNull(),
  status: mysqlEnum("willyStatus", ["nova", "vista", "aceite", "dispensada"]).notNull().default("nova"),
  referenceKey: varchar("referenceKey", { length: 180 }).notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("willy_company_reference_unique").on(table.companyId, table.referenceKey), index("willy_company_status_idx").on(table.companyId, table.status)]);

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  actorId: int("actorId").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 80 }),
  summary: varchar("summary", { length: 500 }).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("audit_company_created_idx").on(table.companyId, table.createdAt)]);
