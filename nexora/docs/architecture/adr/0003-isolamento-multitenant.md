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

## Defesa em profundidade: RLS (implementado na 0.9.0)
- `src/db/rls.ts` (`ensureRls`, corre após as migrations em cada arranque): cria o papel `nexora_tenant`
  (NOLOGIN, sem BYPASSRLS), dá-lhe acesso às tabelas e cria a política `nx_tenant_isolation` em todas as
  tabelas com `tenant_id` e em `tenants`. A política só restringe quando o papel ativo é `nexora_tenant`:
  `tenant_id = current_setting('app.tenant_id')`, em `USING` e `WITH CHECK`.
- `src/core/context.ts` (`tenantScopeHook`): depois de resolver a sessão, o pedido reserva uma ligação,
  fixa `app.tenant_id` e faz `SET ROLE nexora_tenant`; o resto do pedido corre dentro de
  `AsyncLocalStorage`, e o `db` exportado por `src/db/client.ts` resolve para essa ligação. No fim do
  pedido a ligação é reposta (`RESET ROLE`, `RESET app.tenant_id`) e devolvida ao pool.
- Fora do âmbito, por atravessarem empresas: `/api/auth/*` (sessões e lista de empresas do utilizador),
  `/api/admin/*`, `/api/webhooks/*`, jobs e scripts. Uma rota pode sair com `config: { crossTenant: true }`.
- Superutilizadores e o dono das tabelas ignoram RLS; por isso a restrição vem do `SET ROLE`, não do
  papel de ligação.
- `DB_RLS=required` faz o arranque falhar se não for possível ativar (recomendado em produção).

## Verificação do RLS
`src/test/rls.test.ts`: cobertura de todas as tabelas, leitura/escrita/alteração/eliminação de outra
empresa sem filtro na aplicação, transações e savepoints, falha fechada sem empresa, ligação limpa ao
voltar ao pool e pedidos HTTP reais a correr no papel restrito.
