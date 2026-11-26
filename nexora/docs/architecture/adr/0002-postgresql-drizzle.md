# ADR-0002 — PostgreSQL + Drizzle ORM

- Estado: aceite · Data: 2026-11-23

## Decisão
PostgreSQL 16 com **Drizzle ORM** (uma só ORM) e migrations SQL versionadas (`drizzle-kit generate`).
O protótipo anterior usava MySQL; mudámos para PostgreSQL conforme a especificação (transações,
`SELECT … FOR UPDATE`, jsonb, arrays, RLS disponível).

## Consequências
- Isolamento multi-tenant aplicado na camada de aplicação (todas as consultas com `tenant_id` do contexto
  autenticado) e verificado por testes. **Row-Level Security** fica como reforço planeado (ADR-0003).
