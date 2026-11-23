# Threat model inicial (STRIDE)

Ativos: dados empresariais por tenant, dados pessoais/salariais, credenciais e segredos TOTP,
faturação, configuração comercial, registos de auditoria, capacidade de ação da IA.

| Ameaça | Vetor | Mitigação implementada | Verificação |
| --- | --- | --- | --- |
| **S**poofing — roubo de conta | credential stuffing, phishing | bcrypt (12 rondas), bloqueio após 5 falhas (15 min), 2FA TOTP + códigos de recuperação de uso único (hash), política de 2FA por empresa, alerta de novo dispositivo, término remoto de sessões | `ai-security.test.ts` (2FA, bloqueio) |
| Sequestro de sessão | roubo de cookie, CSRF | token aleatório 256 bits guardado como SHA-256, cookie httpOnly + SameSite=Lax (+ secure em prod), cabeçalho anti-CSRF obrigatório em escritas, expiração por inatividade e absoluta | `isolation.test.ts` (CSRF) |
| **T**ampering — alteração de auditoria | acesso à BD | cadeia de hashes por tenant + endpoint de verificação | `ai-security.test.ts` |
| Webhooks forjados / repetidos | chamada direta ao endpoint | HMAC-SHA256 com comparação em tempo constante, idempotência por `event_id`, transição de estado condicional | `billing.test.ts` |
| **R**epudiation | negação de ações | auditoria com ator, IP, trace id, antes/depois em alterações comerciais e de permissões | — |
| **I**nformation disclosure — fuga entre tenants | IDs manipulados, tenant_id injetado | tenant só da sessão, filtros em todas as consultas, 404 genérico | `isolation.test.ts` |
| Fuga via IA / prompt injection | instruções em registos/documentos | ferramentas em allowlist com permissões do utilizador, resultados tratados como dados, política por empresa, sem acesso direto à BD | `ai-security.test.ts` |
| Dados sensíveis (salários) | perfis sem permissão | `employees.view_salary` filtra salário em listagens, exportação e acesso de suporte | `rbac.test.ts` |
| Acesso indevido da equipa Nexora | técnicos curiosos | sem acesso por omissão; concessão temporária autorizada pela empresa, por âmbito, auditada e visível para o cliente | — |
| Injeção SQL / XSS | inputs | ORM parametrizado, validação Zod, React escapa output, CSV com proteção contra fórmulas, cabeçalhos helmet/nginx | — |
| **D**enial of service / abuso de API | força bruta, scraping | rate limit global (300/min/IP) e estrito em login/2FA/IA/webhooks; paginação máx. 100 | — |
| Acesso a dados de outra unidade | utilizador restrito manipula `branchId` | `branchCondition`/`resolveBranchForWrite` no servidor; unidades validadas contra o tenant; gestores restritos não alargam o âmbito de outros | `branch-scope.test.ts` |
| **E**levation of privilege | chamada direta a endpoints, admin secundário | `authorize()` em todas as rotas; permissões admin só para administradores; secundários não concedem fora do seu âmbito nem gerem administradores; segregação de funções | `rbac.test.ts` |
| Exposição de segredos | repositório | `.env` ignorado, `.env.example` sem segredos, TOTP encriptado AES-256-GCM em repouso | — |

## Riscos residuais / a tratar antes de produção
- RLS no PostgreSQL como defesa em profundidade (ADR-0003).
- WAF, deteção de anomalias e alertas de segurança centralizados (hoje: rate limit + bloqueio + alertas de dispositivo).
- Rotação de `ENCRYPTION_KEY` (re-encriptação de segredos TOTP) e gestão via secret manager.
- Pentest externo e revisão de dependências (SCA) no CI.
- SSRF: a plataforma não faz pedidos a URLs fornecidas por utilizadores; manter esta regra ao integrar novos conectores.
