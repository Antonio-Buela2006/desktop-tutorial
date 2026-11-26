# ADR-0004 — Jobs periódicos em processo (v1)

- Estado: aceite · Data: 2026-11-23

## Decisão
Renovações, reconciliação de estados, avisos de atraso, alertas de IA, reposição de créditos e
purga da lixeira correm em `jobs/jobs.ts`, executados pelo `worker.ts` (processo separado em
produção) ou em processo em desenvolvimento. Todos são idempotentes (chaves de deduplicação).

## Consequências
Sem Redis/BullMQ na v1 (menos infraestrutura). Quando a carga o justificar, as mesmas funções passam
a ser consumidas por filas (a especificação recomenda Redis + BullMQ).

## Concorrência entre processos (0.18.0)
Com mais de uma instância (API em processo + worker, ou várias réplicas), as tarefas podiam correr em simultâneo.
- `runJobsExclusive` usa um advisory lock do PostgreSQL (`pg_try_advisory_lock`) numa ligação reservada: só um
  processo executa de cada vez; os outros não esperam e registam `skipped`.
- Cada execução fica em `job_runs` (origem, máquina, estado, duração, resultado, erro), visível no portal Nexora
  (Parâmetros globais → Execuções das tarefas), com aviso quando não há sucesso há mais de 3 intervalos.
- Defesa adicional ao nível dos dados: índice único `(tenant_id, meta->>'renewalKey')` nas faturas de renovação,
  reposição de créditos de IA e cancelamento de subscrições com atualização condicional (só quem faz a transição
  regista o movimento e a auditoria).

