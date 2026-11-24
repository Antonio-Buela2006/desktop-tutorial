# Changelog

## 0.10.0 — 2026-11-24
- Notificações e e-mails do servidor em português e inglês:
  - catálogo de mensagens com chaves e parâmetros (`core/messages.ts`);
  - cada notificação é apresentada no idioma de quem a lê e acompanha a mudança de idioma;
  - e-mails no idioma do destinatário (convites no idioma predefinido da empresa);
  - as notificações antigas com título reconhecível foram convertidas.
- 93 testes (catálogo completo nos dois idiomas com os mesmos parâmetros; a mesma notificação em PT e EN para leitores diferentes).

## 0.9.0 — 2026-11-24
- Row-Level Security no PostgreSQL como segunda barreira de isolamento entre empresas (ADR-0003):
  - papel `nexora_tenant` sem `BYPASSRLS` e política em todas as tabelas com `tenant_id` (e em `tenants`), aplicada a leitura e escrita;
  - cada pedido de empresa corre numa ligação reservada com `app.tenant_id` fixado; sem empresa definida não se vê nada (falha fechada);
  - aplicado automaticamente a tabelas novas em cada arranque; transações e savepoints suportados;
  - `DB_RLS=auto|required|off`, `DB_POOL_MAX`; estado visível em `/api/health`.
- 89 testes (7 novos de RLS, incluindo tentativas de leitura, escrita, alteração e eliminação noutra empresa sem filtro na aplicação).

## 0.8.0 — 2026-11-24
- Guias de transferência de stock entre o armazém central e as unidades:
  - pedido com várias linhas, motivo e transportador, numerado (GT-00001…);
  - aprovação por outra pessoa (segregação de funções) com a nova permissão `inventory.approve_transfer`; ao aprovar, o stock sai da origem e fica em trânsito;
  - receção confirmada no destino; rejeição com motivo; cancelamento por quem pediu;
  - guia de transporte em PDF; stock em trânsito visível na lista de produtos;
  - utilizadores restritos a unidades só veem e tratam guias das suas unidades.
- A transferência imediata passa a exigir a permissão de aprovar transferências.
- As funções predefinidas das empresas existentes recebem as permissões novas do catálogo sem repor as que a empresa retirou.
- 82 testes.

## 0.7.0 — 2026-11-23
- Importação CSV de clientes e produtos com pré-visualização linha a linha (erros e duplicados no ficheiro e na base) e confirmação; grava só as linhas válidas e regista auditoria.
- Retenção de dados aplicada:
  - as demonstrações expiradas têm os dados fictícios limpos após o prazo;
  - as empresas canceladas, depois do prazo de retenção, são eliminadas no portal Nexora com confirmação pelo nome, motivo e bloqueio sob retenção legal;
  - os dados pessoais são anonimizados e os registos financeiros, as vendas, as faturas e a auditoria são conservados.
- Incidentes no portal Nexora: abertura, atualizações e resolução; as empresas afetadas são notificadas (notificação não silenciável) e veem um aviso no painel.
- 78 testes.

## 0.6.0 — 2026-11-23
- Interface em inglês: site público, entrada e registo, painel da empresa, IA e portal Nexora.
- Dicionário central PT→EN aplicado automaticamente pelos componentes base: títulos, campos, botões, tabelas, opções, alertas e mensagens de erro por código.
- Seletor de idioma no site público; preferência de idioma guardada na conta e aplicada ao entrar.

## 0.5.0 — 2026-11-23
- Stock por unidade, com armazém central e transferências; o total da empresa mantém-se consistente.
- As vendas de uma unidade só consomem o stock dessa unidade; as anulações repõem-no na mesma localização.
- Ajustes por localização; utilizadores restritos não movimentam o armazém central.
- Numeração das vendas sem corridas entre vendas simultâneas (lock por empresa).
- 72 testes.

## 0.4.0 — 2026-11-23
- Âmbito por unidade: vendas e finanças passam a ter unidade, e os utilizadores podem ser restringidos a unidades.
- O âmbito é aplicado no servidor em listas, criação, dashboard, IA (previsões e simulações), pesquisa, exportação e documentos.
- Filtros por unidade no dashboard, vendas e finanças.
- 68 testes.

## 0.3.0 — 2026-11-23
- Preferências de notificação por utilizador: e-mail, silenciar tipos de alerta e horário de silêncio. Segurança e faturação não podem ser silenciadas; os e-mails já não se repetem.
- Alertas inteligentes configuráveis: stock/rutura, despesas anormais com multiplicador, queda de vendas projetada e e-mail para alertas críticos.
- Unidades/filiais com associação de funcionários.
- Retenção legal (*legal hold*) e anonimização de dados pessoais de ex-funcionários.
- Antivírus ClamAV nos uploads, com falha fechada.
- Guia de primeiros passos no dashboard.
- Correção global de estilos (camada `components` do Tailwind).
- 64 testes.

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
