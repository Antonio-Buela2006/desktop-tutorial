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
- [ ] Rastreio: definir `OTEL_EXPORTER_OTLP_ENDPOINT` (coletor OTLP/HTTP do fornecedor escolhido), `OTEL_SERVICE_NAME` e `OTEL_TRACES_SAMPLER_RATIO` (ex.: 0.1 em produção); confirmar o cabeçalho `x-trace-id` nas respostas.
- [ ] Observabilidade: recolher `/api/metrics` (Bearer `METRICS_TOKEN`) em Prometheus/Grafana; alertas para
      `nexora_http_errors_total`, `nexora_auth_failures_total`, `nexora_ip_blocks_total` e latência p95; logs JSON centralizados.
- [ ] Ficheiros: `STORAGE_DRIVER=s3` com bucket privado, encriptação e versionamento; antivírus nos uploads.
- [ ] Definir `DB_RLS=required` (o arranque falha se o RLS não puder ser ativado) e confirmar `"rls": true` em `/api/health`. O papel de ligação precisa de poder criar o papel `nexora_tenant` (ou um DBA cria-o antes) — ADR-0003.
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

## Rotação da chave de encriptação (`ENCRYPTION_KEY`)
A chave protege os segredos de 2FA em repouso (AES-256-GCM) e, sem `BACKUP_ENCRYPTION_KEY`, os backups. Cada valor
guarda o identificador da chave (8 hex do SHA-256, nunca a chave), por isso a rotação faz-se sem interrupção:

1. Gerar a nova chave no secret manager: `openssl rand -hex 32`.
2. Publicar com `ENCRYPTION_KEY=<nova>` e `ENCRYPTION_KEYS_PREVIOUS=<antiga>` (a aplicação lê as duas e encripta com a nova).
3. Correr `pnpm --filter api keys:rotate`: re-encripta os segredos com a nova chave (idempotente; não sobrepõe valores alterados entretanto) e regista `security.keys_rotated` na auditoria.
4. Confirmar com `pnpm --filter api keys:rotate --check` (sai com código 2 se ainda houver pendentes).
5. Retirar a antiga de `ENCRYPTION_KEYS_PREVIOUS` só quando já não for precisa para restaurar backups antigos
   (os backups são lidos com qualquer chave do porta-chaves). Guardá-la no secret manager até esses backups expirarem.

Em caso de suspeita de fuga da chave: rodar de imediato e, além disso, pedir aos utilizadores que reconfigurem o 2FA
(os segredos antigos podiam ter sido lidos com a chave comprometida).

