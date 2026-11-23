/**
 * Importação em massa por CSV com pré-visualização (§11 "pré-visualização para operações em lote").
 * Fluxo: preview (valida tudo, nada é gravado) → commit (revalida no servidor e grava só as linhas válidas,
 * numa única transação). Permissões, módulo e tenant validados como em qualquer criação.
 */
import type { FastifyInstance } from "fastify";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { customers, products, stockMovements } from "../db/schema.js";
import { audit } from "../core/audit.js";
import { auditBase, authorize, requireCtx, type Ctx } from "../core/context.js";
import { badRequest } from "../core/errors.js";
import { parse } from "../core/http.js";

const MAX_ROWS = 2000;

/** Parser CSV (RFC 4180): aspas, aspas duplicadas, separador "," ou ";" (detetado na 1.ª linha). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (h: string) => h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const num = (v: string | undefined) => (v === undefined || v.trim() === "" ? undefined : Number(v.trim().replace(/\s/g, "").replace(",", ".")));

type DatasetDef = {
  permission: string;
  columns: Record<string, string[]>; // campo → cabeçalhos aceites (normalizados)
  required: string[];
  schema: z.ZodTypeAny;
  key?: string; // campo único para detetar duplicados
  existingKeys?: (ctx: Ctx, keys: string[]) => Promise<Set<string>>;
  insert: (ctx: Ctx, rows: any[]) => Promise<number>;
};

const DATASETS: Record<string, DatasetDef> = {
  customers: {
    permission: "crm.create",
    columns: { name: ["nome", "name", "cliente"], email: ["email", "correio"], phone: ["telefone", "phone", "telemovel"], taxId: ["nif", "taxid", "contribuinte"], notes: ["notas", "notes", "observacoes"] },
    required: ["name"],
    schema: z.object({
      name: z.string().trim().min(2, "Nome demasiado curto").max(160),
      email: z.string().trim().email("E-mail inválido").max(160).optional(),
      phone: z.string().trim().max(40).optional(),
      taxId: z.string().trim().max(40).optional(),
      notes: z.string().max(2000).optional(),
    }),
    key: "taxId",
    existingKeys: async (ctx, keys) => {
      if (!keys.length) return new Set();
      const r = await db.select({ k: customers.taxId }).from(customers).where(and(eq(customers.tenantId, ctx.tenant.id), isNull(customers.deletedAt), inArray(customers.taxId, keys)));
      return new Set(r.map((x) => x.k!));
    },
    insert: async (ctx, rows) => {
      if (!rows.length) return 0;
      await db.insert(customers).values(rows.map((r) => ({ ...r, tenantId: ctx.tenant.id })));
      return rows.length;
    },
  },
  products: {
    permission: "inventory.create",
    columns: { sku: ["sku", "codigo", "referencia", "ref"], name: ["nome", "name", "produto", "designacao"], unitPrice: ["preco", "price", "precovenda", "unitprice"], unitCost: ["custo", "cost", "unitcost", "precocusto"], reorderLevel: ["reposicao", "reorderlevel", "stockminimo", "minimo"], initialStock: ["stock", "stockinicial", "quantidade", "qty"] },
    required: ["sku", "name", "unitPrice"],
    schema: z.object({
      sku: z.string().trim().min(1, "SKU obrigatório").max(40),
      name: z.string().trim().min(2, "Nome demasiado curto").max(160),
      unitPrice: z.number({ message: "Preço inválido" }).min(0, "Preço negativo").max(1e12),
      unitCost: z.number({ message: "Custo inválido" }).min(0).max(1e12).default(0),
      reorderLevel: z.number({ message: "Nível de reposição inválido" }).int("Nível de reposição deve ser inteiro").min(0).default(0),
      initialStock: z.number({ message: "Stock inválido" }).int("Stock deve ser inteiro").min(0, "Stock negativo").default(0),
    }),
    key: "sku",
    existingKeys: async (ctx, keys) => {
      if (!keys.length) return new Set();
      const r = await db.select({ k: products.sku }).from(products).where(and(eq(products.tenantId, ctx.tenant.id), inArray(products.sku, keys)));
      return new Set(r.map((x) => x.k));
    },
    insert: async (ctx, rows) => {
      if (!rows.length) return 0;
      return db.transaction(async (tx) => {
        const created = await tx.insert(products).values(rows.map(({ initialStock, ...r }) => ({ ...r, stockQty: initialStock, tenantId: ctx.tenant.id }))).returning();
        const moves = created.filter((p) => p.stockQty > 0).map((p) => ({ tenantId: ctx.tenant.id, productId: p.id, delta: p.stockQty, reason: "Stock inicial (importação)", refType: "import", createdBy: ctx.membership.id }));
        if (moves.length) await tx.insert(stockMovements).values(moves);
        return created.length;
      });
    },
  },
};

const NUMERIC = new Set(["unitPrice", "unitCost", "reorderLevel", "initialStock"]);

type RowResult = { line: number; data: Record<string, unknown>; errors: string[]; status: "ok" | "error" | "duplicate" };

export async function analyse(ctx: Ctx, dataset: string, csv: string) {
  const def = DATASETS[dataset];
  const rows = parseCsv(csv);
  if (rows.length < 2) throw badRequest("O ficheiro precisa de uma linha de cabeçalho e pelo menos uma linha de dados.");
  if (rows.length - 1 > MAX_ROWS) throw badRequest(`Máximo de ${MAX_ROWS} linhas por importação.`);
  const header = rows[0].map(norm);
  const mapping: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(def.columns)) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx >= 0) mapping[field] = idx;
  }
  const missing = def.required.filter((f) => mapping[f] === undefined);
  if (missing.length) throw badRequest(`Colunas obrigatórias em falta: ${missing.join(", ")}.`, { expected: Object.fromEntries(Object.entries(def.columns).map(([k, v]) => [k, v[0]])) });
  const results: RowResult[] = rows.slice(1).map((r, i) => {
    const raw: Record<string, unknown> = {};
    for (const [field, idx] of Object.entries(mapping)) {
      const v = (r[idx] ?? "").trim();
      if (v === "") continue;
      raw[field] = NUMERIC.has(field) ? num(v) : v;
    }
    const p = def.schema.safeParse(raw);
    return p.success
      ? { line: i + 2, data: p.data as Record<string, unknown>, errors: [] as string[], status: "ok" as const }
      : { line: i + 2, data: raw, errors: p.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`), status: "error" as const };
  });
  // Duplicados: dentro do ficheiro e com registos existentes
  if (def.key) {
    const seen = new Set<string>();
    const keys = results.filter((r) => r.status === "ok" && r.data[def.key!]).map((r) => String(r.data[def.key!]));
    const existing = await def.existingKeys!(ctx, [...new Set(keys)]);
    for (const r of results) {
      const k = r.data[def.key] ? String(r.data[def.key]) : null;
      if (!k || r.status !== "ok") continue;
      if (existing.has(k)) { r.status = "duplicate"; r.errors.push(`Já existe um registo com ${def.key} "${k}".`); }
      else if (seen.has(k)) { r.status = "duplicate"; r.errors.push(`${def.key} "${k}" repetido no ficheiro.`); }
      seen.add(k);
    }
  }
  return {
    columns: Object.keys(mapping),
    ignoredColumns: rows[0].filter((_, i) => !Object.values(mapping).includes(i)),
    total: results.length,
    valid: results.filter((r) => r.status === "ok").length,
    errors: results.filter((r) => r.status === "error").length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    rows: results,
  };
}

export async function importRoutes(app: FastifyInstance) {
  const body = z.object({ csv: z.string().min(1).max(5_000_000) });
  const params = z.object({ dataset: z.enum(["customers", "products"]) });

  app.post("/api/import/:dataset/preview", { bodyLimit: 6_000_000 }, async (req) => {
    const ctx = requireCtx(req);
    const { dataset } = parse(params, req.params);
    authorize(ctx, DATASETS[dataset].permission);
    const r = await analyse(ctx, dataset, parse(body, req.body).csv);
    return { ...r, rows: r.rows.slice(0, 500) };
  });

  app.post("/api/import/:dataset/commit", { bodyLimit: 6_000_000 }, async (req) => {
    const ctx = requireCtx(req);
    const { dataset } = parse(params, req.params);
    const def = DATASETS[dataset];
    authorize(ctx, def.permission);
    const r = await analyse(ctx, dataset, parse(body, req.body).csv);
    // Só as linhas válidas são gravadas; erros e duplicados são ignorados (o utilizador viu-os na pré-visualização).
    const created = await def.insert(ctx, r.rows.filter((x) => x.status === "ok").map((x) => x.data));
    await audit({ ...auditBase(ctx), action: `import.${dataset}`, entityType: dataset, summary: `Importação CSV: ${created} registo(s) criados; ${r.errors} com erros e ${r.duplicates} duplicados ignorados.`, metadata: { total: r.total, created, errors: r.errors, duplicates: r.duplicates } });
    return { created, skipped: r.total - created };
  });
}
