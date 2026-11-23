# Changelog

## 0.2.0 — 2026-11-23
- Documentos privados de funcionários e clientes, com armazenamento local ou S3, validação do conteúdo, auditoria e purga após o prazo da lixeira.
- Exportação em XLSX e PDF; fatura em PDF.
- E-mail por SMTP.
- Backups encriptados e teste de restauro automático (`pnpm backup`, `pnpm backup:verify`).
- Métricas Prometheus (`/api/metrics`) e bloqueio automático de IP após falhas de autenticação.
- 56 testes automáticos.

## 0.1.0 — 2026-11-23
Primeira versão da plataforma Nexora (monorepo `nexora/`), a partir da especificação mestra v1.0:
API multi-tenant com RBAC, 2FA, sessões, subscrições, pagamentos sandbox com webhooks assinados,
auditoria encadeada, módulos CRM/Stock/Vendas/Finanças, camada de IA com políticas, créditos e
aprovações, portal administrativo Nexora, site público e aplicação web responsiva; 50 testes
automáticos e teste E2E no navegador.
