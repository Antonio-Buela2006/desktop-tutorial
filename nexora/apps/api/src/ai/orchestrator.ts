/** Orquestrador de IA: políticas, créditos, execução segura de ferramentas, aprovações e auditoria. */
import { and, eq, gte, sql as dsql } from "drizzle-orm";
import { db } from "../db/client.js";
import { aiActions, aiCreditTransactions, aiPolicies, aiRequests, aiWallets } from "../db/schema.js";
import { audit } from "../core/audit.js";
import { auditBase, authorize, type Ctx } from "../core/context.js";
import { sha256 } from "../core/crypto.js";
import { AppError, forbidden } from "../core/errors.js";
import { notifyByPermission } from "../core/notify.js";
import { withSpan } from "../observability/tracing.js";
import { describePreview, isMsg, m, render, asLocale, type Locale } from "../core/messages.js";
import { getSetting } from "../modules/billing.routes.js";
import { getProvider, localProvider, type CallTool } from "./providers.js";
import { toolByName, toolsFor, type AITool } from "./tools.js";

export async function getPolicy(tenantId: string) {
  const [p] = await db.select().from(aiPolicies).where(eq(aiPolicies.tenantId, tenantId));
  return p;
}

type Costs = Record<string, number>;
const costsOf = () => getSetting<Costs>("ai_costs", { chat: 1, tool_read: 1, tool_write: 2, forecast: 3, simulation: 3 });

/** Débito atómico de créditos; falha sem afetar o resto da plataforma. */
export async function chargeCredits(ctx: Ctx, amount: number, operation: string, module: string | null, provider: string) {
  if (amount <= 0) return;
  const r = await db
    .update(aiWallets)
    .set({ balance: dsql`${aiWallets.balance} - ${amount}` })
    .where(and(eq(aiWallets.tenantId, ctx.tenant.id), gte(aiWallets.balance, amount)))
    .returning({ balance: aiWallets.balance });
  if (!r.length)
    throw new AppError(402, "AI_CREDITS_EXHAUSTED", "Os créditos de IA esgotaram. As restantes funcionalidades continuam disponíveis; compre um pacote ou faça upgrade para voltar a usar a IA.");
  await db.insert(aiCreditTransactions).values({ tenantId: ctx.tenant.id, membershipId: ctx.membership.id, amount: -amount, operation, module, provider });
}

function assertAiUsable(ctx: Ctx, policy: Awaited<ReturnType<typeof getPolicy>>) {
  authorize(ctx, "ai.use", "read");
  if (!policy?.enabled) throw forbidden("A IA está desativada pela sua empresa.", "AI_DISABLED");
  if (!policy.languages.includes(ctx.user.locale) && policy.languages.length) {
    /* idioma não permitido: responde no primeiro permitido */
  }
}

export async function chat(ctx: Ctx, message: string, locale: string) {
  const policy = await getPolicy(ctx.tenant.id);
  assertAiUsable(ctx, policy);
  const lang = policy.languages.includes(locale) ? locale : policy.languages[0] ?? "pt";
  const costs = await costsOf();
  const provider = getProvider();
  await chargeCredits(ctx, costs.chat ?? 1, "chat", null, provider.name);
  const [reqRow] = await db.insert(aiRequests).values({ tenantId: ctx.tenant.id, membershipId: ctx.membership.id, prompt: message.slice(0, 4000), provider: provider.name }).returning();
  const tools = toolsFor(ctx, policy);
  const calls: { tool: string; input: unknown; outcome: string }[] = [];
  let credits = costs.chat ?? 1;

  const callTool: CallTool = async (name, rawInput) => {
    const tool = toolByName(name);
    // Allowlist + autorização no servidor: ferramentas fora da lista ou sem permissão são recusadas.
    if (!tool || !tools.includes(tool)) {
      calls.push({ tool: name, input: rawInput, outcome: "denied" });
      return { ok: false, error: "Ferramenta não autorizada para este utilizador." };
    }
    const parsed = tool.schema.safeParse(rawInput ?? {});
    if (!parsed.success) return { ok: false, error: "Parâmetros inválidos: " + parsed.error.issues.map((i) => i.message).join("; ") };
    const cost = costs[tool.costKey] ?? 1;
    try {
      await chargeCredits(ctx, cost, tool.name, tool.module, provider.name);
      credits += cost;
      if (tool.sensitivity === "read") {
        const data = await tool.run(ctx, parsed.data);
        calls.push({ tool: name, input: parsed.data, outcome: "executed" });
        return { ok: true, data };
      }
      return await proposeAction(ctx, tool, parsed.data as Record<string, unknown>, reqRow.id, policy, calls, asLocale(lang));
    } catch (e: any) {
      if (e instanceof AppError && e.code === "AI_CREDITS_EXHAUSTED") throw e;
      calls.push({ tool: name, input: parsed.data, outcome: "error" });
      return { ok: false, error: e?.message ?? "Erro" };
    }
  };

  let result;
  let status = "ok";
  try {
    result = await withSpan("ai.provider", { "nexora.ai.provider": provider.name ?? "unknown", "nexora.ai.tools": tools.length }, async (span) => {
      const r = await provider.run({ message, locale: lang, tools, callTool, companyName: ctx.tenant.name });
      span.setAttributes({ "nexora.ai.model": r.model ?? "local", "nexora.ai.tool_calls": calls.length });
      return r;
    });
  } catch (e: any) {
    if (e instanceof AppError) throw e;
    // Fallback quando o fornecedor externo está indisponível.
    status = "fallback";
    result = await localProvider.run({ message, locale: lang, tools, callTool, companyName: ctx.tenant.name });
    result.text = (lang === "en" ? "[External AI unavailable — local assistant used]\n" : "[IA externa indisponível — assistente local utilizado]\n") + result.text;
  }
  await db.update(aiRequests).set({ response: result.text, toolCalls: calls, contextRefs: calls.map((c) => c.tool), model: result.model, credits, status, provider: result.provider }).where(eq(aiRequests.id, reqRow.id));
  await audit({ ...auditBase(ctx), action: "ai.request", entityType: "ai_request", entityId: reqRow.id, summary: `Pedido à IA (${result.provider}); ferramentas: ${calls.map((c) => `${c.tool}:${c.outcome}`).join(", ") || "nenhuma"}.`, metadata: { credits } });
  const pending = await db.select().from(aiActions).where(and(eq(aiActions.requestId, reqRow.id), eq(aiActions.status, "pending")));
  return { requestId: reqRow.id, answer: result.text, provider: result.provider, toolCalls: calls, pendingActions: pending.map((a) => ({ ...a, display: describePreview(a.preview as Record<string, unknown>, a.tool, asLocale(lang)) })), creditsUsed: credits };
}

async function proposeAction(ctx: Ctx, tool: AITool, input: Record<string, unknown>, requestId: string, policy: NonNullable<Awaited<ReturnType<typeof getPolicy>>>, calls: { tool: string; input: unknown; outcome: string }[], locale: Locale = "pt") {
  const preview = tool.preview ? await tool.preview(ctx, input) : { action: { key: tool.name }, data: input };
  const sensitivity = tool.sensitivity === "sensitive" ? "sensitive" : "simple";
  const auto = sensitivity === "simple" && policy.autonomy === "simple_auto";
  const required = tool.module === "finance" && policy.dualApprovalFinancial ? 2 : 1;
  // Idempotência: o mesmo pedido/ferramenta/parâmetros não gera ações duplicadas.
  const idem = sha256(`${requestId}:${tool.name}:${JSON.stringify(input)}`);
  const [action] = await db
    .insert(aiActions)
    .values({ tenantId: ctx.tenant.id, requestId, requestedBy: ctx.membership.id, tool: tool.name, input, preview, sensitivity, requiredApprovals: required, idempotencyKey: idem })
    .onConflictDoNothing()
    .returning();
  if (!action) return { ok: true, data: "Ação já registada." };
  await audit({ ...auditBase(ctx), actorType: "ai", action: "ai.action_proposed", entityType: "ai_action", entityId: action.id, summary: `IA propôs "${tool.name}" (${sensitivity}).`, metadata: { input } });
  if (auto) {
    const r = await executeAction(ctx, action.id, true);
    calls.push({ tool: tool.name, input, outcome: "executed_auto" });
    return { ok: true, data: r };
  }
  calls.push({ tool: tool.name, input, outcome: "pending_approval" });
  await notifyByPermission(ctx.tenant.id, "ai.approve", { type: "ai.approval", severity: "warning", title: m("ai.approval.title"), body: m("ai.approval.body", { requester: ctx.user.name, action: isMsg(preview.action) ? preview.action : tool.name }), link: "/app/ai?tab=approvals" });
  return { ok: true, pendingApproval: { actionId: action.id, preview: describePreview(preview, tool.name, locale) } };
}

/** Executa uma ação aprovada exatamente uma vez (transição condicional de estado). */
async function executeAction(ctx: Ctx, actionId: string, auto = false, approvedBy?: string) {
  const [claimed] = await db
    .update(aiActions)
    .set({ status: "approved", decidedAt: new Date(), decidedBy: auto ? null : ctx.membership.id })
    .where(and(eq(aiActions.id, actionId), eq(aiActions.tenantId, ctx.tenant.id), eq(aiActions.status, "pending")))
    .returning();
  if (!claimed) throw new AppError(409, "ALREADY_PROCESSED", "Esta ação já foi processada.");
  const tool = toolByName(claimed.tool)!;
  try {
    const result = await tool.run(ctx, tool.schema.parse(claimed.input), { approvedBy });
    await db.update(aiActions).set({ status: "executed", executedAt: new Date(), result: { ok: true, result: JSON.parse(JSON.stringify(result ?? null)) } }).where(eq(aiActions.id, actionId));
    await audit({ ...auditBase(ctx), actorType: "ai", action: "ai.action_executed", entityType: "ai_action", entityId: actionId, summary: `Ação "${claimed.tool}" executada${auto ? " automaticamente (política: tarefas simples)" : ` após aprovação de ${ctx.user.name}`}.` });
    return result;
  } catch (e: any) {
    await db.update(aiActions).set({ status: "failed", result: { ok: false, error: String(e?.message ?? e) } }).where(eq(aiActions.id, actionId));
    await audit({ ...auditBase(ctx), actorType: "ai", action: "ai.action_failed", entityType: "ai_action", entityId: actionId, summary: `Falha ao executar "${claimed.tool}": ${e?.message ?? e}` });
    throw e;
  }
}

export async function decideAction(ctx: Ctx, actionId: string, decision: "approve" | "reject") {
  authorize(ctx, "ai.approve");
  const [a] = await db.select().from(aiActions).where(and(eq(aiActions.id, actionId), eq(aiActions.tenantId, ctx.tenant.id)));
  if (!a) throw new AppError(404, "NOT_FOUND", "Recurso não encontrado.");
  if (a.status !== "pending") throw new AppError(409, "ALREADY_PROCESSED", "Esta ação já foi processada.");
  const tool = toolByName(a.tool)!;
  // O aprovador tem de ter a permissão subjacente.
  authorize(ctx, tool.permission);
  if (a.sensitivity === "sensitive" && a.requestedBy === ctx.membership.id)
    throw forbidden("Não pode aprovar uma ação sensível pedida por si (segregação de funções).", "SEGREGATION_OF_DUTIES");
  if (decision === "reject") {
    await db.update(aiActions).set({ status: "rejected", decidedBy: ctx.membership.id, decidedAt: new Date() }).where(and(eq(aiActions.id, a.id), eq(aiActions.status, "pending")));
    await audit({ ...auditBase(ctx), action: "ai.action_rejected", entityType: "ai_action", entityId: a.id, summary: `Ação "${a.tool}" rejeitada.` });
    return { status: "rejected" };
  }
  if (a.approvals.some((x) => x.membershipId === ctx.membership.id)) throw forbidden("Já aprovou esta ação.");
  const approvals = [...a.approvals, { membershipId: ctx.membership.id, at: new Date().toISOString() }];
  await db.update(aiActions).set({ approvals }).where(eq(aiActions.id, a.id));
  await audit({ ...auditBase(ctx), action: "ai.action_approved", entityType: "ai_action", entityId: a.id, summary: `Aprovação ${approvals.length}/${a.requiredApprovals} da ação "${a.tool}".` });
  if (approvals.length < a.requiredApprovals) return { status: "pending", approvals: approvals.length, required: a.requiredApprovals };
  const result = await executeAction(ctx, a.id, false, ctx.membership.id);
  return { status: "executed", result };
}
