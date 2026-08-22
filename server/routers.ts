import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { assertPermission } from "./rbac";
import {
  addCustomer,
  addAttendance,
  addEmployee,
  addFinancialEntry,
  addInventoryAdjustment,
  addProduct,
  addSupplier,
  addWarehouse,
  createLeaveRequest,
  createPerformanceReview,
  createIntegratedSale,
  createWorkspace,
  getDashboard,
  getWorkspace,
  listAccounting,
  listAudit,
  listCatalog,
  listCustomers,
  listFinance,
  listHumanResources,
  getHumanResourcesData,
  listLogistics,
  listSales,
  listTeamMembers,
  assignTeamRole,
} from "./nexoraDb";
import { analyzeWithWilly, askWilly, enableWillyDailyAnalysis, listWillyRecommendations, updateWillyRecommendation } from "./willy";
import { buildCsvReport } from "./reports";

async function workspaceFor(userId: number) {
  const workspace = await getWorkspace(userId);
  if (!workspace) throw new Error("Conclua a configuração inicial da empresa.");
  return workspace;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  nexora: router({
    context: protectedProcedure.query(async ({ ctx }) => getWorkspace(ctx.user.id)),
    bootstrap: protectedProcedure.input(z.object({ companyName: z.string().min(2).max(180), sector: z.string().max(120).optional(), taxNumber: z.string().max(64).optional(), email: z.string().email().optional(), phone: z.string().max(40).optional() })).mutation(async ({ ctx, input }) => createWorkspace({ userId: ctx.user.id, ...input })),
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "dashboard.view");
      return getDashboard(workspace.companyId);
    }),
    customers: router({
      list: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "crm.view"); return listCustomers(workspace.companyId); }),
      create: protectedProcedure.input(z.object({ name: z.string().min(2).max(180), taxNumber: z.string().max(64).optional(), email: z.string().email().optional(), phone: z.string().max(40).optional(), address: z.string().max(2000).optional(), notes: z.string().max(5000).optional() })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "crm.manage"); return addCustomer({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
    }),
    catalog: router({
      list: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "logistics.view"); return listCatalog(workspace.companyId); }),
      createProduct: protectedProcedure.input(z.object({ sku: z.string().min(1).max(80), name: z.string().min(2).max(180), salePrice: z.number().nonnegative(), costPrice: z.number().nonnegative(), description: z.string().max(3000).optional(), warehouseId: z.number().int().positive(), openingQuantity: z.number().int().nonnegative(), minimumQuantity: z.number().int().nonnegative() })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "logistics.manage"); return addProduct({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
      createWarehouse: protectedProcedure.input(z.object({ name: z.string().min(2).max(120), location: z.string().max(240).optional() })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "logistics.manage"); return addWarehouse({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
      adjustInventory: protectedProcedure.input(z.object({ inventoryId: z.number().int().positive(), quantity: z.number().int(), note: z.string().min(2).max(320) })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "logistics.manage"); return addInventoryAdjustment({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
    }),
    finance: router({
      list: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "finance.view"); return listFinance(workspace.companyId); }),
      create: protectedProcedure.input(z.object({ type: z.enum(["receita", "despesa"]), category: z.string().min(2).max(120), description: z.string().min(2).max(320), amount: z.number().positive(), dueDate: z.string().optional(), status: z.enum(["pendente", "pago"]).default("pendente") })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "finance.manage"); return addFinancialEntry({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
    }),
    accounting: router({ list: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "accounting.view"); return listAccounting(workspace.companyId); }) }),
    sales: router({
      list: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "crm.view"); return listSales(workspace.companyId); }),
      create: protectedProcedure.input(z.object({ customerId: z.number().int().positive(), items: z.array(z.object({ productId: z.number().int().positive(), warehouseId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1), notes: z.string().max(3000).optional(), deliveryAddress: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "sales.manage"); return createIntegratedSale({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
    }),
    hr: router({
      list: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "hr.view"); return listHumanResources(workspace.companyId); }),
      overview: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "hr.view"); return getHumanResourcesData(workspace.companyId); }),
      createEmployee: protectedProcedure.input(z.object({ fullName: z.string().min(2).max(180), email: z.string().email().optional(), jobTitle: z.string().max(120).optional(), hiredAt: z.string().optional() })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "hr.manage"); return addEmployee({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
      recordAttendance: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), date: z.string().min(10), status: z.enum(["presente", "ausente", "justificado", "remoto"]), notes: z.string().max(320).optional() })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "hr.manage"); return addAttendance({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
      requestLeave: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), startDate: z.string().min(10), endDate: z.string().min(10), notes: z.string().max(320).optional() })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "hr.manage"); return createLeaveRequest({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
      createReview: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), score: z.number().int().min(1).max(5), comments: z.string().max(5000).optional() })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "hr.manage"); return createPerformanceReview({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
    }),
    logistics: router({
      list: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "logistics.view"); return listLogistics(workspace.companyId); }),
      createSupplier: protectedProcedure.input(z.object({ name: z.string().min(2).max(180), taxNumber: z.string().max(64).optional(), email: z.string().email().optional(), phone: z.string().max(40).optional(), address: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "logistics.manage"); return addSupplier({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
    }),
    team: router({
      list: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "team.manage"); return listTeamMembers(workspace.companyId); }),
      assignRole: protectedProcedure.input(z.object({ email: z.string().email(), role: z.enum(["administrador", "gestor", "contabilista", "rh", "comercial", "logistica", "funcionario"]) })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "team.manage"); return assignTeamRole({ companyId: workspace.companyId, actorId: ctx.user.id, ...input }); }),
    }),
    willy: router({
      list: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "willy.view"); return listWillyRecommendations(workspace.companyId); }),
      analyze: protectedProcedure.mutation(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "willy.view"); return analyzeWithWilly(workspace.companyId, ctx.user.id); }),
      enableDailyAnalysis: protectedProcedure.mutation(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "settings.manage"); const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? ""; return enableWillyDailyAnalysis(workspace.companyId, sessionToken); }),
      chat: protectedProcedure.input(z.object({ question: z.string().min(3).max(1200) })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "willy.chat"); return askWilly(workspace.companyId, input.question); }),
      feedback: protectedProcedure.input(z.object({ recommendationId: z.number().int().positive(), status: z.enum(["vista", "aceite", "dispensada"]), feedback: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "willy.view"); return updateWillyRecommendation({ companyId: workspace.companyId, ...input }); }),
    }),
    reports: router({
      exportCsv: protectedProcedure.input(z.object({ module: z.enum(["financeiro", "vendas", "stock", "auditoria"]) })).query(async ({ ctx, input }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "audit.view"); return buildCsvReport(workspace.companyId, input.module); }),
    }),
    audit: router({ list: protectedProcedure.query(async ({ ctx }) => { const workspace = await workspaceFor(ctx.user.id); assertPermission(workspace.role, "audit.view"); return listAudit(workspace.companyId); }) }),
  }),
});

export type AppRouter = typeof appRouter;
