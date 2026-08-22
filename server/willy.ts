import { and, desc, eq, isNull } from "drizzle-orm";
import { companies, financialEntries, inventory, products, sales, willyRecommendations } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { createHeartbeatJob } from "./_core/heartbeat";
import { sendWillyCriticalEmail } from "./willyEmail";

type Category = "stock" | "financeiro" | "comercial" | "operacional";
type Severity = "informativo" | "atencao" | "critico";
export type Recommendation = { category: Category; severity: Severity; title: string; recommendation: string; rationale: string; confidence: number; referenceKey: string };
type WillyStockSignal = { inventoryId: number; quantity: number; minimumQuantity: number; productName: string; sku: string };
type WillyFinancialSignal = { type: "receita" | "despesa"; status: string; dueDate: Date | null; amount: unknown };
const num = (value: unknown) => Number(value ?? 0);

export function buildWillyRecommendations(stockRows: WillyStockSignal[], financeRows: WillyFinancialSignal[], salesCount: number, now = new Date()): Recommendation[] {
  const recommendations: Recommendation[] = [];
  for (const item of stockRows.filter(item => item.quantity <= item.minimumQuantity)) {
    const shortage = Math.max(1, item.minimumQuantity - item.quantity + 1);
    recommendations.push({ category: "stock", severity: item.quantity === 0 ? "critico" : "atencao", title: `${item.productName} abaixo do nível mínimo`, recommendation: `Planeie a reposição de pelo menos ${shortage} unidade(s) do artigo ${item.sku}.`, rationale: `O stock atual é ${item.quantity} unidade(s) e o limite mínimo definido é ${item.minimumQuantity}.`, confidence: 98, referenceKey: `stock-${item.inventoryId}` });
  }
  const overdue = financeRows.filter(row => row.status !== "pago" && row.dueDate && new Date(row.dueDate) < now);
  const overdueTotal = overdue.reduce((sum, row) => sum + num(row.amount), 0);
  if (overdue.length) recommendations.push({ category: "financeiro", severity: overdueTotal > 0 ? "critico" : "atencao", title: `${overdue.length} pagamento(s) em atraso`, recommendation: "Priorize o contacto, a cobrança ou a regularização dos movimentos vencidos.", rationale: `Foram identificados ${overdue.length} movimento(s) com vencimento anterior a hoje, num total de ${overdueTotal.toFixed(2)}.`, confidence: 96, referenceKey: "financeiro-vencidos" });
  const revenue = financeRows.filter(row => row.type === "receita").reduce((sum, row) => sum + num(row.amount), 0);
  const expenses = financeRows.filter(row => row.type === "despesa").reduce((sum, row) => sum + num(row.amount), 0);
  if (expenses > revenue && expenses > 0) recommendations.push({ category: "financeiro", severity: "atencao", title: "Despesas acumuladas acima das receitas", recommendation: "Reveja custos variáveis, pagamentos não prioritários e o calendário de recebimentos.", rationale: `As despesas registadas (${expenses.toFixed(2)}) superam as receitas (${revenue.toFixed(2)}) no período disponível.`, confidence: 90, referenceKey: "financeiro-margem-negativa" });
  if (!salesCount) recommendations.push({ category: "comercial", severity: "informativo", title: "Sem vendas registadas", recommendation: "Registe as oportunidades e vendas concluídas para ativar a análise comercial do WILLY.", rationale: "Ainda não existem vendas no histórico da empresa.", confidence: 100, referenceKey: "comercial-sem-vendas" });
  return recommendations;
}

export async function listWillyRecommendations(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  return db.select().from(willyRecommendations).where(eq(willyRecommendations.companyId, companyId)).orderBy(desc(willyRecommendations.updatedAt)).limit(100);
}

export async function analyzeWithWilly(companyId: number, actorId?: number) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const [companyRows, stockRows, financeRows, saleRows] = await Promise.all([
    db.select({ name: companies.name, email: companies.email }).from(companies).where(eq(companies.id, companyId)).limit(1),
    db.select({ inventoryId: inventory.id, quantity: inventory.quantity, minimumQuantity: inventory.minimumQuantity, productName: products.name, sku: products.sku }).from(inventory).innerJoin(products, eq(inventory.productId, products.id)).where(eq(inventory.companyId, companyId)),
    db.select().from(financialEntries).where(and(eq(financialEntries.companyId, companyId), isNull(financialEntries.deletedAt))),
    db.select().from(sales).where(and(eq(sales.companyId, companyId), isNull(sales.deletedAt))).orderBy(desc(sales.createdAt)).limit(90),
  ]);
  const company = companyRows[0];
  if (!company) throw new Error("Empresa não encontrada.");
  const recommendations = buildWillyRecommendations(stockRows, financeRows, saleRows.length);

  for (const rec of recommendations) {
    await db.insert(willyRecommendations).values({ companyId, ...rec }).onDuplicateKeyUpdate({ set: { severity: rec.severity, title: rec.title, recommendation: rec.recommendation, rationale: rec.rationale, confidence: rec.confidence, status: "nova", updatedAt: new Date() } });
    if (rec.severity === "critico" && company.email) {
      try { await sendWillyCriticalEmail({ to: company.email, companyName: company.name, ...rec }); } catch (error) { console.error("[WILLY] Alerta crítico por email não enviado:", error); }
    }
  }
  return { createdOrUpdated: recommendations.length, recommendations };
}

export async function updateWillyRecommendation(input: { companyId: number; recommendationId: number; status: "vista" | "aceite" | "dispensada"; feedback?: string }) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  await db.update(willyRecommendations).set({ status: input.status, feedback: input.feedback || null, updatedAt: new Date() }).where(and(eq(willyRecommendations.id, input.recommendationId), eq(willyRecommendations.companyId, input.companyId)));
}

export async function askWilly(companyId: number, question: string) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const [companyRows, stockRows, financeRows, saleRows] = await Promise.all([
    db.select({ name: companies.name, currency: companies.currency }).from(companies).where(eq(companies.id, companyId)).limit(1),
    db.select({ product: products.name, quantity: inventory.quantity, minimum: inventory.minimumQuantity }).from(inventory).innerJoin(products, eq(inventory.productId, products.id)).where(eq(inventory.companyId, companyId)),
    db.select({ type: financialEntries.type, status: financialEntries.status, amount: financialEntries.amount, category: financialEntries.category, dueDate: financialEntries.dueDate }).from(financialEntries).where(and(eq(financialEntries.companyId, companyId), isNull(financialEntries.deletedAt))),
    db.select({ code: sales.code, totalAmount: sales.totalAmount, createdAt: sales.createdAt }).from(sales).where(and(eq(sales.companyId, companyId), isNull(sales.deletedAt))).orderBy(desc(sales.createdAt)).limit(30),
  ]);
  const company = companyRows[0];
  if (!company) throw new Error("Empresa não encontrada.");
  const context = { company: company.name, currency: company.currency, stock: stockRows, finance: financeRows.map(row => ({ ...row, amount: num(row.amount) })), recentSales: saleRows.map(row => ({ ...row, totalAmount: num(row.totalAmount) })) };
  const response = await invokeLLM({
    model: "gpt-5-mini",
    reasoning: { effort: "low" },
    maxTokens: 650,
    response_format: { type: "json_schema", json_schema: { name: "willy_answer", strict: true, schema: { type: "object", properties: { answer: { type: "string" }, rationale: { type: "string" }, confidence: { type: "integer", minimum: 0, maximum: 100 }, limitations: { type: "string" } }, required: ["answer", "rationale", "confidence", "limitations"], additionalProperties: false } } },
    messages: [
      { role: "system", content: "És WILLY, o assistente explicável do NEXORA. Responde apenas com base no contexto de dados fornecido. Nunca inventes valores, nunca faças aconselhamento jurídico, fiscal ou financeiro personalizado, e explicita as limitações. Usa português europeu e uma linguagem profissional." },
      { role: "user", content: `Contexto isolado da empresa: ${JSON.stringify(context)}\n\nPergunta do gestor: ${question}` },
    ],
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new Error("O WILLY não devolveu uma resposta legível.");
  return JSON.parse(content) as { answer: string; rationale: string; confidence: number; limitations: string };
}

export async function enableWillyDailyAnalysis(companyId: number, sessionToken: string) {
  const db = await getDb();
  if (!db) throw new Error("A base de dados não está disponível.");
  const company = (await db.select({ id: companies.id, name: companies.name, taskUid: companies.willyScheduleCronTaskUid }).from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  if (!company) throw new Error("Empresa não encontrada.");
  if (company.taskUid) return { taskUid: company.taskUid, alreadyEnabled: true };
  const job = await createHeartbeatJob({ name: `willy-anomalias-${company.id}`, cron: "0 0 8 * * *", path: "/api/scheduled/willy-anomalies", payload: { companyId: company.id }, description: `Análise diária WILLY para ${company.name}` }, sessionToken);
  await db.update(companies).set({ willyScheduleCronTaskUid: job.taskUid }).where(eq(companies.id, company.id));
  return { taskUid: job.taskUid, alreadyEnabled: false, nextExecutionAt: job.nextExecutionAt };
}
