# ADR-0005 — Camada de IA independente do fornecedor

- Estado: aceite · Data: 2026-11-23

## Decisão
`AIProvider` com duas implementações: **local** (determinística, sem custos, fallback) e **Claude**
(Anthropic Messages API com *tool use*, modelo configurável, *fallbacks* do lado do servidor).
O modelo nunca acede à BD: só chama ferramentas de uma *allowlist* executadas no servidor com
`authorize()` do utilizador. Escritas simples podem ser automáticas (política); sensíveis criam
`ai_actions` pendentes que exigem aprovação de outra pessoa com a permissão subjacente.

## Consequências
Trocar de modelo/fornecedor não afeta módulos. Créditos debitados atomicamente; esgotados → 402 só na IA.
