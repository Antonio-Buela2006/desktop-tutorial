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
- [ ] Agendar backups (ex.: cron a cada 4h: `pnpm backup`) e o teste de restauro diário (`pnpm backup:verify`,
      sai com código ≠ 0 se falhar → alerta). Sincronizar `BACKUP_DIR` para outra região. Definir RPO/RTO.
- [ ] Observabilidade: recolher `/api/metrics` (Bearer `METRICS_TOKEN`) em Prometheus/Grafana; alertas para
      `nexora_http_errors_total`, `nexora_auth_failures_total`, `nexora_ip_blocks_total` e latência p95; logs JSON centralizados.
- [ ] Ficheiros: `STORAGE_DRIVER=s3` com bucket privado, encriptação e versionamento; antivírus nos uploads.
- [ ] Ativar RLS (ADR-0003) e rever o threat model.
- [ ] Fornecedor de pagamentos real validado (sandbox, contrato, webhooks) e dados bancários configurados.
- [ ] Textos legais, fiscalidade e retenção aprovados profissionalmente.
- [ ] Pentest / revisão de segurança e plano de resposta a incidentes.
- [ ] Rollback: imagens versionadas; migrations apenas aditivas por release.

## Backups e restauro (implementado)

```bash
PG_BIN=/usr/lib/postgresql/16/bin pnpm backup          # pg_dump encriptado AES-256-GCM + manifesto SHA-256, retenção BACKUP_KEEP
PG_BIN=/usr/lib/postgresql/16/bin pnpm backup:verify   # restaura numa BD temporária e valida
```

O teste de restauro verifica as checksums, restaura o backup numa base temporária, valida as cadeias de
auditoria de todas as empresas, confirma que não há registos órfãos (isolamento preservado), regista as
contagens por empresa e grava `last-restore-test.json`. Restaurar dados de uma só empresa implica
filtrar por `tenant_id` a partir da cópia restaurada; é um procedimento manual e auditado.
