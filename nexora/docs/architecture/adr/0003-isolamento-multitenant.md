# ADR-0003 — Isolamento multi-tenant

- Estado: aceite · Data: 2026-11-23

## Decisão
Base de dados partilhada com coluna `tenant_id` em todos os registos de negócio. O tenant é obtido
**exclusivamente** da sessão (`sessions.tenant_id` + verificação da `membership` ativa). Corpos de
pedido nunca definem `tenant_id` (o servidor sobrepõe-no). Recursos de outro tenant devolvem **404
genérico** (não revelam existência).

## Verificação
`src/test/isolation.test.ts`: leitura/edição/eliminação por ID alheio, venda com produto alheio,
`tenantId` injetado, pesquisa global, exportação e link de download, faturas e auditoria.

## Próximo passo (recomendado antes de produção)
Ativar RLS do PostgreSQL com `SET LOCAL app.tenant_id` por transação e um papel de BD sem
`BYPASSRLS`, como defesa em profundidade.
