# ADR-0001 — Monólito modular em TypeScript

- Estado: aceite · Data: 2026-11-23

## Contexto
A especificação (§12) recomenda começar como monólito modular, com tecnologias maduras, e cita
Next.js + NestJS como referência. O repositório já usava React/Vite + Node/TypeScript.

## Decisão
API única em **Fastify + TypeScript** organizada por domínios (`core/`, `modules/`, `ai/`, `jobs/`) e
SPA **React + Vite**. Monorepo pnpm (`apps/api`, `apps/web`).

## Consequências
- (+) Um só deploy, transações simples entre domínios (ex.: venda + stock + auditoria).
- (+) Fastify é leve, rápido e tem validação/OpenAPI; Vite dá builds rápidos e divisão de bundles.
- (−) Sem SSR: o site público é SPA (SEO limitado). Mitigação futura: pré-renderização ou Next.js
  só para o site público. Fronteiras entre domínios permitem extração futura de serviços.
