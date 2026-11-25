# API Nexora v1

Documentação OpenAPI interativa: `GET /api/docs` (gerada pelo Fastify Swagger).

Convenções:
- Autenticação por cookie `nx_session` (httpOnly, SameSite=Lax); portal Nexora usa `nx_admin`.
- Pedidos de escrita exigem o cabeçalho `x-nexora-csrf: 1`.
- Erros: `{ "error": { "code", "message", "details?" } }`. Códigos relevantes: `UNAUTHENTICATED`,
  `MFA_REQUIRED`, `MFA_ENROLLMENT_REQUIRED`, `FORBIDDEN`, `MODULE_NOT_CONTRACTED`,
  `SUBSCRIPTION_READ_ONLY`, `SUBSCRIPTION_SUSPENDED`, `LIMIT_REACHED`, `SEGREGATION_OF_DUTIES`,
  `AI_CREDITS_EXHAUSTED` (402), `RATE_LIMITED` (429), `NOT_FOUND` (404 genérico, também para recursos de outra empresa).
- Listagens: `?page&pageSize(≤100)&q&sort&dir` → `{ items, total }`.
- Cada resposta inclui `x-request-id` (correlação com logs).
- Pagamentos: `POST /api/billing/invoices/:id/pay` exige `idempotencyKey`; webhooks em
  `POST /api/webhooks/payments/:provider` com `x-nexora-signature = HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, corpo)`.

| Grupo | Prefixo |
| --- | --- |
| Público | `/api/public/*`, `/api/health` |
| Autenticação, 2FA, sessões, convites | `/api/auth/*` |
| Empresa (utilizadores, funções, funcionários, definições, titularidade) | `/api/company/*`, `/api/meta/permissions`, `/api/search` |
| Negócio | `/api/dashboard`, `/api/crm/*`, `/api/inventory/*` (inclui guias `transfer-orders` e `stock-forecast`), `/api/sales/*`, `/api/finance/*` (inclui `cashflow-forecast`) |
| Subscrição e faturação | `/api/billing/*`, `/api/payments/sandbox/*`, `/api/webhooks/*` |
| IA | `/api/ai/*` |
| Governação | `/api/audit*`, `/api/notifications*`, `/api/trash*`, `/api/exports*`, `/api/support/*` |
| Portal Nexora | `/api/admin/*` |
