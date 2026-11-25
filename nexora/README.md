# Nexora — plataforma SaaS de gestão empresarial

Plataforma web **multiempresa**, **modular** e **assistida por IA** para PME, implementada a partir da
[especificação mestra](docs/product/Nexora_Master_Specification.md) (versão 1.0).

> Estado: **MVP técnico funcional** (fases 1–3 e núcleo das fases 5–6 da especificação), com dados
> persistidos em PostgreSQL, autorização no servidor e testes automáticos. Valores comerciais, nomes
> oficiais dos 18 módulos, fiscalidade e textos legais estão **pendentes de decisão** e são
> configuráveis — ver [decisões pendentes](docs/product/pending-decisions.md).

## O que está implementado

| Área | Funcionalidades |
| --- | --- |
| Site público | Início, funcionalidades, módulos, planos (preços "a definir" até confirmação), segurança, sobre, contacto, FAQ, termos/privacidade/cookies, registo em passos, login |
| Identidade | E-mail + palavra-passe, bloqueio após 5 falhas, **2FA TOTP** (Google/Microsoft Authenticator) com códigos de recuperação, política de 2FA por empresa, sessões/dispositivos com término remoto, expiração por inatividade, limite de dispositivos, alerta de novo dispositivo, recuperação de conta, convites |
| Multi-tenancy | Tenant obtido **sempre da sessão**; todas as consultas filtradas por `tenant_id` **e RLS no PostgreSQL** (cada pedido de empresa corre num papel restrito à sua empresa); testes negativos de isolamento horizontal e vertical |
| RBAC | 46 permissões granulares, 9 funções predefinidas + personalizadas, ajustes por utilizador (conceder/negar), acessos temporários com validade, segregação de funções, administradores principal/secundários com âmbito delegado, transferência segura de titularidade |
| Subscrição | Planos Starter/Professional/Enterprise configuráveis, limites **independentes** de funcionários e utilizadores, trial 14 dias com dados fictícios, módulos com dependências, troca gratuita nos 7 primeiros dias e proporcional depois, upgrade/downgrade com pré-visualização, capacidade adicional, cancelamento no fim do período, regras de atraso **1–3 / 4–8 / 9+** aplicadas no servidor |
| Pagamentos | Camada desacoplada de fornecedores (sandbox, transferência bancária com reconciliação manual, Multicaixa Express preparado), **webhooks HMAC**, idempotência, faturas com estados, ativação automática após pagamento |
| Módulos de negócio | **Importação CSV com pré-visualização** (clientes e produtos: erros e duplicados por linha antes de gravar); Clientes (CRM), Stock (com movimentos, ajustes, **stock por unidade + armazém central, guias de transferência com aprovação, trânsito e guia em PDF**), Vendas (baixa de stock transacional), Finanças (aprovação com segregação) — nomes provisórios |
| IA | Camada independente do fornecedor (local determinístico ou Claude via `ANTHROPIC_API_KEY`), políticas por empresa (restrito/personalizado/geral, autonomia, módulos), ferramentas em *allowlist* com as permissões do utilizador, **aprovação humana** para ações sensíveis (dupla opcional), idempotência, créditos com bloqueio isolado, previsões e simulações explicáveis, alertas inteligentes, voz (Web Speech API) e PT/EN |
| Governação | Auditoria **encadeada por hash** com verificação, notificações, exportação CSV/JSON/XLSX/PDF com link temporário, documentos privados (local/S3) de funcionários e clientes, faturas em PDF, lixeira recuperável (30 dias, configurável), retenção legal de registos financeiros, acesso de suporte excecional (autorizado pela empresa, com prazo e âmbito) |
| Empresa | Unidades/filiais com **âmbito por unidade** (utilizadores restritos só veem e registam funcionários, vendas e finanças das suas unidades — também no dashboard, IA, pesquisa, exportação e documentos), preferências de notificação (canais, silenciar alertas, horário de silêncio), alertas configuráveis (stock, despesas anormais, queda de vendas), retenção legal (*legal hold*), anonimização de ex-funcionários, guia de primeiros passos |
| Operação | Antivírus ClamAV nos uploads (opcional), backups encriptados com **teste de restauro automático**, métricas Prometheus, e-mail SMTP, bloqueio automático de IP após falhas de autenticação |
| Idiomas | Interface em **português e inglês** (dicionário central em `apps/web/src/lib/en.ts`, aplicado automaticamente pelos componentes base); preferência por utilizador guardada na conta; IA responde no idioma escolhido |
| Portal Nexora | Login separado (2FA), **incidentes** (com aviso às empresas afetadas), **retenção de dados** (execução aprovada, com confirmação e respeito pela retenção legal), métricas agregadas, empresas (só metadados), planos/preços/limites, catálogo dos 18 módulos, parâmetros globais, reconciliação de pagamentos, suporte, auditoria |

## Arquitetura

Monólito modular (ver [ADR-0001](docs/architecture/adr/0001-monolito-modular.md)):

```
nexora/
  apps/api      Fastify + TypeScript + Drizzle ORM + PostgreSQL (API v1, OpenAPI em /api/docs)
  apps/web      React 19 + Vite + Tailwind CSS 4 + TanStack Query (site, painel da empresa, portal Nexora)
  docs/         arquitetura, ADRs, ERD, segurança, API, manuais, decisões pendentes
  infra/docker  Dockerfiles e nginx
  tests/e2e     teste de ponta a ponta no navegador (Playwright)
```

## Executar localmente (VS Code)

Requisitos: Node.js 22 LTS, pnpm 10, Docker (ou PostgreSQL 16 local).

```bash
cd nexora
cp .env.example .env            # gere ENCRYPTION_KEY com: openssl rand -hex 32
docker compose up -d db         # PostgreSQL em localhost:5432 (cria também nexora_test)
pnpm install
pnpm db:migrate && pnpm db:seed # planos, catálogo, admin Nexora e empresa demo (dados fictícios)
pnpm dev                        # API em :4000 e web em http://localhost:5173
```

Contas de desenvolvimento (apenas seed local):

| Onde | Utilizador | Palavra-passe |
| --- | --- | --- |
| Empresa demo — administrador | `demo@nexora.local` | `DemoNexora2026` |
| Empresa demo — vendedor | `vendedor@nexora.local` | `VendedorNexora2026` |
| Portal Nexora (`/admin`) | `admin@nexora.local` | `ChangeMe!2026` (defina `SEED_PLATFORM_ADMIN_PASSWORD`) |

Repor a base local: `pnpm db:reset` (proibido em produção).

### Comandos de qualidade

```bash
pnpm typecheck   # TypeScript strict (api + web)
pnpm test        # 102 testes: unitários + integração em PostgreSQL real (base nexora_test)
pnpm build       # build da API e da web
node tests/e2e/smoke.cjs   # E2E no navegador (com `pnpm dev` + seed; requer `npm i -g playwright && npx playwright install chromium`)
```

Os testes de integração cobrem: isolamento entre empresas (IDs manipulados, tenant_id injetado,
pesquisa, exportação, faturas), permissões chamando a API diretamente, módulos não contratados,
limites independentes, saída de funcionário (revoga sessões e liberta vaga), atraso 1–3/4–8/9+,
idempotência de pagamentos e webhooks, troca de módulos, downgrade sem perda de dados,
cancelamento, conversão de trial, IA (permissões herdadas, política restrita, aprovação com
segregação, execução única, créditos esgotados só bloqueiam a IA), 2FA, bloqueio de conta e
deteção de adulteração da auditoria.

### IA com Claude (opcional)

Por omissão a IA usa um fornecedor local determinístico (sem custos). Para usar Claude:
`AI_PROVIDER=anthropic` e `ANTHROPIC_API_KEY=...` no `.env` (modelo `claude-opus-5-5`, configurável em
`ANTHROPIC_MODEL`). Se o fornecedor falhar, a plataforma recorre automaticamente ao assistente local.

## Documentação

- [Arquitetura e ERD](docs/architecture/overview.md) · [ADRs](docs/architecture/adr/)
- [Threat model](docs/security/threat-model.md) · [Matriz RBAC](docs/security/rbac-matrix.md)
- [API](docs/api/README.md) (OpenAPI interativo em `http://localhost:4000/api/docs`)
- [Deploy e operação](docs/architecture/deployment.md)
- [Manual do administrador](docs/manuals/admin.md) · [Manual do utilizador](docs/manuals/user.md) · [Guia de suporte](docs/manuals/support.md)
- [Decisões pendentes](docs/product/pending-decisions.md) · [Limitações conhecidas](docs/product/known-limitations.md) · [Changelog](CHANGELOG.md)

## Regras do projeto

- Nunca colocar segredos no Git (`.env` está ignorado); dados de seed são sempre fictícios.
- Autorização **sempre** no servidor (`authorize()` em `apps/api/src/core/context.ts`).
- Não inventar preços, limites, nomes dos 18 módulos ou requisitos legais: usar configuração.
