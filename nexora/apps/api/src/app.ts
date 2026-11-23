import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { config } from "./config.js";
import { AppError } from "./core/errors.js";
import { contextHook } from "./core/context.js";
import { authRoutes } from "./modules/auth.routes.js";
import { companyRoutes } from "./modules/company.routes.js";
import { governanceRoutes } from "./modules/governance.routes.js";
import { businessRoutes } from "./modules/business.routes.js";
import { billingRoutes } from "./modules/billing.routes.js";
import { adminRoutes } from "./modules/admin.routes.js";
import { publicRoutes } from "./modules/public.routes.js";
import { aiRoutes } from "./ai/ai.routes.js";
import multipart from "@fastify/multipart";
import { fileRoutes } from "./modules/files.routes.js";
import { registerObservability } from "./core/observability.js";

export async function buildApp() {
  const app = Fastify({
    logger: config.isTest ? false : { level: "info", redact: ["req.headers.cookie", "req.headers.authorization"] },
    trustProxy: true,
    bodyLimit: 1_000_000,
    genReqId: (req) => (req.headers["x-request-id"] as string) || randomUUID(),
  });

  // Guarda o corpo bruto (necessário para validar assinaturas de webhooks).
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as any).rawBody = body;
    if (!body || (body as string).length === 0) return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(new AppError(400, "BAD_JSON", "JSON inválido."), undefined);
    }
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: config.webOrigin, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: config.isTest ? 10_000 : 300, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 + 1, files: 1, fields: 5 } });
  registerObservability(app);
  await app.register(swagger, { openapi: { info: { title: "Nexora API", version: "1.0.0", description: "API v1 da plataforma Nexora (multi-tenant)." } } });
  await app.register(swaggerUi, { routePrefix: "/api/docs" });

  app.addHook("onRequest", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });
  app.addHook("preHandler", contextHook);

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof AppError) return reply.code(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    if (err instanceof ZodError) return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Dados inválidos.", details: { issues: err.issues } } });
    if (err.statusCode === 429) return reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Demasiados pedidos. Aguarde um momento." } });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: { code: err.code ?? "BAD_REQUEST", message: err.message } });
    req.log.error(err);
    // Nunca expõe detalhes internos.
    return reply.code(500).send({ error: { code: "INTERNAL", message: "Ocorreu um erro inesperado.", traceId: req.id } });
  });

  await app.register(publicRoutes);
  await app.register(authRoutes);
  await app.register(companyRoutes);
  await app.register(governanceRoutes);
  await app.register(businessRoutes);
  await app.register(billingRoutes);
  await app.register(aiRoutes);
  await app.register(fileRoutes);
  await app.register(adminRoutes);
  return app;
}
