import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { asc, desc, type AnyColumn, type SQL } from "drizzle-orm";
import { badRequest } from "./errors.js";
import { config } from "../config.js";

/** Valida o corpo/query com Zod e devolve erros legíveis (400). */
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const i of r.error.issues) fields[i.path.join(".") || "_"] = i.message;
    throw badRequest("Dados inválidos.", { fields });
  }
  return r.data;
}

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  sort: z.string().max(40).optional(),
  dir: z.enum(["asc", "desc"]).default("desc"),
});

export const uuidParam = z.object({ id: z.string().uuid() });

export function setSessionCookie(reply: FastifyReply, name: string, token: string, maxAgeSeconds: number) {
  reply.setCookie(name, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: maxAgeSeconds,
  });
}

export const clientInfo = (req: FastifyRequest) => ({ ip: req.ip, userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300) });

/** Escape CSV (inclui proteção contra injeção de fórmulas em folhas de cálculo). */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

/**
 * Ordenação de listas a partir de `sort`/`dir`, só por colunas da lista permitida (nunca por nome
 * de coluna vindo do cliente). Coluna desconhecida ou ausente → ordem por omissão da lista.
 * `tieBreak` garante ordem estável entre páginas quando há valores repetidos.
 */
export function orderFor(q: { sort?: string; dir: "asc" | "desc" }, allowed: Record<string, AnyColumn | SQL>, fallback: SQL[], tieBreak: AnyColumn) {
  const col = q.sort && Object.prototype.hasOwnProperty.call(allowed, q.sort) ? allowed[q.sort] : undefined;
  if (!col) return fallback;
  return [q.dir === "asc" ? asc(col) : desc(col), asc(tieBreak)];
}
