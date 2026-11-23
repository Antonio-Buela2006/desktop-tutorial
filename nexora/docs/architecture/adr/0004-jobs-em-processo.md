# ADR-0004 — Jobs periódicos em processo (v1)

- Estado: aceite · Data: 2026-11-23

## Decisão
Renovações, reconciliação de estados, avisos de atraso, alertas de IA, reposição de créditos e
purga da lixeira correm em `jobs/jobs.ts`, executados pelo `worker.ts` (processo separado em
produção) ou em processo em desenvolvimento. Todos são idempotentes (chaves de deduplicação).

## Consequências
Sem Redis/BullMQ na v1 (menos infraestrutura). Quando a carga o justificar, as mesmas funções passam
a ser consumidas por filas (a especificação recomenda Redis + BullMQ).
