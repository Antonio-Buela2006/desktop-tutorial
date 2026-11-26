/**
 * Execução da política de retenção (§2.2, §6.4, §10.5).
 * - Demonstrações expiradas: os dados são fictícios, por isso são limpos automaticamente após o prazo.
 * - Empresas canceladas/expiradas: eliminação/anonimização só com aprovação de um administrador Nexora (owner),
 *   nunca sob retenção legal. Registos financeiros, vendas, faturas, pagamentos e auditoria são CONSERVADOS
 *   (obrigação legal); dados pessoais e operacionais são anonimizados ou eliminados.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  aiRequests,
  customers,
  employees,
  exportJobs,
  fileAssets,
  memberships,
  notifications,
  products,
  sessions,
  stockLevels,
  stockMovements,
  tenants,
} from "../db/schema.js";
import { audit } from "./audit.js";
import { deleteObject } from "./storage.js";
import { purgeBusinessData } from "./demoData.js";

export async function purgeExpiredTrial(tenantId: string) {
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).for("update");
    if (!t?.isDemo || t.settings.dataPurgedAt || t.settings.legalHold) return;
    await purgeBusinessData(tenantId, tx);
    await tx.update(tenants).set({ settings: { ...t.settings, dataPurgedAt: new Date().toISOString() } }).where(eq(tenants.id, tenantId));
    await audit({ tenantId, actorType: "system", action: "retention.trial_purged", summary: "Demonstração expirada: dados fictícios eliminados após o prazo de retenção." }, tx);
  });
}

export async function purgeCanceledTenant(tenantId: string, adminId: string) {
  const files = await db.select().from(fileAssets).where(eq(fileAssets.tenantId, tenantId));
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).for("update");
    if (!t || t.settings.dataPurgedAt) return;
    const now = new Date();
    // Acesso: todas as contas desta empresa desativadas e sessões terminadas.
    await tx.update(memberships).set({ status: "disabled", disabledAt: now }).where(and(eq(memberships.tenantId, tenantId), eq(memberships.status, "active")));
    await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.tenantId, tenantId), isNull(sessions.revokedAt)));
    // Dados pessoais: anonimizados (mantêm-se as referências das vendas/registos financeiros).
    await tx.update(customers).set({ name: "Cliente anonimizado", email: null, phone: null, taxId: null, notes: null }).where(eq(customers.tenantId, tenantId));
    await tx.update(employees).set({ fullName: "Funcionário anonimizado", email: null, anonymizedAt: now }).where(eq(employees.tenantId, tenantId));
    // Dados operacionais sem obrigação legal: eliminados.
    await tx.delete(stockMovements).where(eq(stockMovements.tenantId, tenantId));
    await tx.delete(stockLevels).where(eq(stockLevels.tenantId, tenantId));
    await tx.delete(products).where(eq(products.tenantId, tenantId));
    await tx.delete(aiRequests).where(eq(aiRequests.tenantId, tenantId));
    await tx.delete(notifications).where(eq(notifications.tenantId, tenantId));
    await tx.delete(exportJobs).where(eq(exportJobs.tenantId, tenantId));
    await tx.delete(fileAssets).where(eq(fileAssets.tenantId, tenantId));
    await tx.update(tenants).set({ settings: { ...t.settings, dataPurgedAt: now.toISOString() } }).where(eq(tenants.id, tenantId));
    await audit({ tenantId, actorType: "platform_admin", actorId: adminId, action: "retention.tenant_purged", summary: "Fim do prazo de retenção: dados pessoais anonimizados e dados operacionais eliminados; registos financeiros, vendas, faturas e auditoria conservados." }, tx);
  });
  for (const f of files) await deleteObject(f.storageKey).catch(() => {});
  await audit({ tenantId: null, actorType: "platform_admin", actorId: adminId, action: "retention.tenant_purged", entityType: "tenant", entityId: tenantId, summary: `Retenção executada para a empresa ${tenantId}.` });
}
