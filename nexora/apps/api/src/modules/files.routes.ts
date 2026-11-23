/** Documentos privados associados a funcionários e clientes (referências documentais). */
import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { customers, employees, fileAssets } from "../db/schema.js";
import { audit } from "../core/audit.js";
import { auditBase, authorize, requireCtx, type Ctx } from "../core/context.js";
import { badRequest, notFound } from "../core/errors.js";
import { parse, uuidParam } from "../core/http.js";
import { deleteObject, getObject, MAX_FILE_BYTES, putObject, sanitizeFileName, storageKey, validateFile } from "../core/storage.js";
import { createHash, randomUUID } from "node:crypto";

const ENTITIES = {
  employee: { table: employees, view: "employees.view", edit: "employees.edit" },
  customer: { table: customers, view: "crm.view", edit: "crm.edit" },
} as const;
type EntityType = keyof typeof ENTITIES;

async function assertEntity(ctx: Ctx, type: EntityType, id: string) {
  const t: any = ENTITIES[type].table;
  const [row] = await db.select({ id: t.id }).from(t).where(and(eq(t.id, id), eq(t.tenantId, ctx.tenant.id), isNull(t.deletedAt)));
  if (!row) throw notFound();
}

const entityParams = z.object({ entityType: z.enum(["employee", "customer"]), entityId: z.string().uuid() });

export async function fileRoutes(app: FastifyInstance) {
  app.get("/api/files/:entityType/:entityId", async (req) => {
    const ctx = requireCtx(req);
    const p = parse(entityParams, req.params);
    authorize(ctx, ENTITIES[p.entityType].view);
    await assertEntity(ctx, p.entityType, p.entityId);
    return db
      .select({ id: fileAssets.id, fileName: fileAssets.fileName, contentType: fileAssets.contentType, size: fileAssets.size, category: fileAssets.category, createdAt: fileAssets.createdAt })
      .from(fileAssets)
      .where(and(eq(fileAssets.tenantId, ctx.tenant.id), eq(fileAssets.entityType, p.entityType), eq(fileAssets.entityId, p.entityId), isNull(fileAssets.deletedAt)))
      .orderBy(desc(fileAssets.createdAt));
  });

  app.post("/api/files/:entityType/:entityId", async (req) => {
    const ctx = requireCtx(req);
    const p = parse(entityParams, req.params);
    authorize(ctx, ENTITIES[p.entityType].edit);
    await assertEntity(ctx, p.entityType, p.entityId);
    const part = await (req as any).file({ limits: { fileSize: MAX_FILE_BYTES + 1, files: 1 } });
    if (!part) throw badRequest("Nenhum ficheiro enviado.");
    const data: Buffer = await part.toBuffer();
    const category = typeof part.fields?.category?.value === "string" ? String(part.fields.category.value).slice(0, 60) : null;
    validateFile(part.mimetype, data);
    const id = randomUUID();
    const key = storageKey(ctx.tenant.id, id);
    await putObject(key, data, part.mimetype);
    const [f] = await db
      .insert(fileAssets)
      .values({ id, tenantId: ctx.tenant.id, entityType: p.entityType, entityId: p.entityId, fileName: sanitizeFileName(part.filename), contentType: part.mimetype, size: data.length, sha256: createHash("sha256").update(data).digest("hex"), storageKey: key, category, uploadedBy: ctx.membership.id })
      .returning();
    await audit({ ...auditBase(ctx), action: "file.uploaded", entityType: p.entityType, entityId: p.entityId, summary: `Documento "${f.fileName}" carregado (${Math.round(f.size / 1024)} KB).`, metadata: { fileId: f.id, sha256: f.sha256 } });
    return { id: f.id, fileName: f.fileName, size: f.size };
  });

  app.get("/api/files/download/:id", async (req, reply) => {
    const ctx = requireCtx(req);
    const { id } = parse(uuidParam, req.params);
    const [f] = await db.select().from(fileAssets).where(and(eq(fileAssets.id, id), eq(fileAssets.tenantId, ctx.tenant.id), isNull(fileAssets.deletedAt)));
    if (!f) throw notFound();
    authorize(ctx, ENTITIES[f.entityType as EntityType].view, "export");
    const data = await getObject(f.storageKey);
    // Verificação de integridade antes de entregar
    if (createHash("sha256").update(data).digest("hex") !== f.sha256) throw badRequest("Ficheiro corrompido; contacte o suporte.");
    await audit({ ...auditBase(ctx), action: "file.downloaded", entityType: f.entityType, entityId: f.entityId, summary: `Documento "${f.fileName}" descarregado.`, metadata: { fileId: f.id } });
    reply
      .header("content-type", f.contentType)
      .header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(f.fileName)}`)
      .header("x-content-type-options", "nosniff")
      .header("cache-control", "private, no-store");
    return data;
  });

  app.delete("/api/files/:id", async (req) => {
    const ctx = requireCtx(req);
    const { id } = parse(uuidParam, req.params);
    const [f] = await db.select().from(fileAssets).where(and(eq(fileAssets.id, id), eq(fileAssets.tenantId, ctx.tenant.id), isNull(fileAssets.deletedAt)));
    if (!f) throw notFound();
    authorize(ctx, ENTITIES[f.entityType as EntityType].edit);
    await db.update(fileAssets).set({ deletedAt: new Date() }).where(eq(fileAssets.id, id));
    await audit({ ...auditBase(ctx), action: "file.deleted", entityType: f.entityType, entityId: f.entityId, summary: `Documento "${f.fileName}" movido para a lixeira.`, metadata: { fileId: f.id } });
    return { ok: true };
  });
}

/** Purga definitiva de ficheiros eliminados há mais de `days` dias (job). */
export async function purgeDeletedFiles(tenantId: string, cutoff: Date) {
  const rows = await db.select().from(fileAssets).where(eq(fileAssets.tenantId, tenantId));
  let n = 0;
  for (const f of rows) {
    if (f.deletedAt && f.deletedAt < cutoff) {
      await deleteObject(f.storageKey).catch(() => {});
      await db.delete(fileAssets).where(eq(fileAssets.id, f.id));
      n++;
    }
  }
  return n;
}
