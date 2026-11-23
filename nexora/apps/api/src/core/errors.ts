export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const unauthorized = (msg = "Sessão inválida ou expirada.") => new AppError(401, "UNAUTHENTICATED", msg);
export const forbidden = (msg = "Não tem permissão para esta operação.", code = "FORBIDDEN") => new AppError(403, code, msg);
// 404 genérico: nunca revela se o recurso existe noutro tenant
export const notFound = (msg = "Recurso não encontrado.") => new AppError(404, "NOT_FOUND", msg);
export const badRequest = (msg: string, details?: Record<string, unknown>) => new AppError(400, "BAD_REQUEST", msg, details);
export const conflict = (msg: string, code = "CONFLICT", details?: Record<string, unknown>) => new AppError(409, code, msg, details);
