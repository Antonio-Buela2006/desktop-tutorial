# Deploy e operação

## Ambientes
`local` (docker compose), `staging` e `production` separados, cada um com a sua base de dados e
segredos. Nunca copiar dados de produção para outros ambientes sem anonimização e autorização.

## Build e execução
```bash
docker compose --profile full up --build   # api :4000, web :8080, worker
```
Em cloud gerida: imagem `infra/docker/api.Dockerfile` (API e worker com `node dist/worker.js`),
imagem `infra/docker/web.Dockerfile` (nginx com SPA e proxy `/api`), PostgreSQL gerido.
A API aplica migrations e seeds de plataforma idempotentes no arranque.

## Variáveis obrigatórias em produção
`NODE_ENV=production`, `DATABASE_URL`, `ENCRYPTION_KEY` (32 bytes hex, de um secret manager),
`PAYMENT_WEBHOOK_SECRET`, `WEB_ORIGIN`, `MAIL_TRANSPORT` (fornecedor real), opcional `ANTHROPIC_API_KEY`.
Em produção o fornecedor `sandbox` é recusado e os links de convite não são devolvidos pela API.

## Checklist antes de produção (§16, §20)
- [ ] TLS/HTTPS, WAF e rate limiting no edge; cookies `secure` (automático com `NODE_ENV=production`).
- [ ] Backups automáticos encriptados várias vezes ao dia, com **teste de restauro** documentado
      (RPO/RTO a definir). `pg_dump`/snapshots geridos; validar isolamento após restauro.
- [ ] Observabilidade: logs centralizados (a API emite JSON com `reqId`), métricas, alertas,
      OpenTelemetry/Sentry (ponto de integração).
- [ ] Ativar RLS (ADR-0003) e rever o threat model.
- [ ] Fornecedor de pagamentos real validado (sandbox, contrato, webhooks) e dados bancários configurados.
- [ ] Textos legais, fiscalidade e retenção aprovados profissionalmente.
- [ ] Pentest / revisão de segurança e plano de resposta a incidentes.
- [ ] Rollback: imagens versionadas; migrations apenas aditivas por release.
