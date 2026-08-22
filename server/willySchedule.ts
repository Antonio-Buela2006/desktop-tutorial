import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { companies } from "../drizzle/schema";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";
import { analyzeWithWilly } from "./willy";

export function registerWillySchedule(app: Express) {
  app.post("/api/scheduled/willy-anomalies", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "database-unavailable" });
      const company = (await db.select().from(companies).where(eq(companies.willyScheduleCronTaskUid, user.taskUid)).limit(1))[0];
      if (!company) return res.json({ ok: true, skipped: "orphan" });
      const result = await analyzeWithWilly(company.id);
      return res.json({ ok: true, companyId: company.id, analyzed: result.createdOrUpdated });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
    }
  });
}
