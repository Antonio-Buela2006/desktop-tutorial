/** Tarefas periódicas com vários processos: sem duplicados e com exclusão mútua. */
import { describe, expect, it } from "vitest";
import { and, eq, sql as dsql } from "drizzle-orm";
import { db, sql } from "../db/client.js";
import { aiCreditTransactions, aiWallets, invoices, jobRuns, subscriptions } from "../db/schema.js";
import { issueRenewals, JOBS_LOCK_KEY, resetAiAllowances, runJobsExclusive } from "../jobs/jobs.js";
import { signupCompany } from "./helpers.js";

describe("tarefas em simultâneo", () => {
  it("duas renovações ao mesmo tempo emitem uma só fatura", async () => {
    const t = await signupCompany({ mode: "paid", plan: "starter" });
    const end = new Date(Date.now() + 86_400_000);
    await db.update(subscriptions).set({ status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: end }).where(eq(subscriptions.tenantId, t.tenantId));
    await Promise.all([issueRenewals(), issueRenewals(), issueRenewals()]);
    const rows = await db.select().from(invoices).where(and(eq(invoices.tenantId, t.tenantId), dsql`${invoices.meta}->>'renewalKey' is not null`));
    expect(rows).toHaveLength(1);
    // a base de dados também recusa um duplicado inserido diretamente
    await expect(db.insert(invoices).values({ ...rows[0], id: undefined as any, number: rows[0].number + "-dup" })).rejects.toThrow();
  });

  it("a reposição mensal de créditos não é lançada a dobrar", async () => {
    const t = await signupCompany();
    await db.update(aiWallets).set({ periodStart: new Date(Date.now() - 40 * 86_400_000), balance: 1, monthlyAllowance: 100 }).where(eq(aiWallets.tenantId, t.tenantId));
    await Promise.all([resetAiAllowances(), resetAiAllowances()]);
    const tx = await db.select().from(aiCreditTransactions).where(and(eq(aiCreditTransactions.tenantId, t.tenantId), eq(aiCreditTransactions.operation, "monthly_allowance")));
    expect(tx).toHaveLength(1);
    const [w] = await db.select().from(aiWallets).where(eq(aiWallets.tenantId, t.tenantId));
    expect(w.balance).toBe(100);
  });

  it("só um processo executa as tarefas de cada vez; as execuções ficam registadas", async () => {
    let calls = 0;
    const work = async () => {
      calls++;
      return { done: true };
    };
    // outro processo detém o bloqueio
    const other = await sql.reserve();
    await other`select pg_advisory_lock(${JOBS_LOCK_KEY})`;
    try {
      expect(await runJobsExclusive("admin", new Date(), work)).toEqual({ skipped: true });
      expect(calls).toBe(0);
    } finally {
      await other`select pg_advisory_unlock(${JOBS_LOCK_KEY})`;
      other.release();
    }
    const r = await runJobsExclusive("admin", new Date(), work);
    expect(r).toMatchObject({ skipped: false, done: true });
    // execuções simultâneas: no máximo uma corre, as outras são ignoradas
    const slow = async () => {
      calls++;
      await new Promise((res) => setTimeout(res, 150));
      return {};
    };
    calls = 0;
    const many = await Promise.all([runJobsExclusive("worker", new Date(), slow), runJobsExclusive("inprocess", new Date(), slow), runJobsExclusive("admin", new Date(), slow)]);
    expect(calls).toBe(1);
    expect(many.filter((x) => x.skipped)).toHaveLength(2);
    // falha registada, e o bloqueio é libertado
    await expect(runJobsExclusive("admin", new Date(), async () => { throw new Error("rebentou"); })).rejects.toThrow("rebentou");
    const runs = await db.select().from(jobRuns).orderBy(dsql`${jobRuns.startedAt} desc`).limit(10);
    expect(runs.some((x) => x.status === "failed" && x.error === "rebentou")).toBe(true);
    expect(runs.some((x) => x.status === "skipped")).toBe(true);
    expect(runs.some((x) => x.status === "ok" && x.durationMs !== null)).toBe(true);
    expect((await runJobsExclusive("admin", new Date(), work)).skipped).toBe(false);
  });
});
