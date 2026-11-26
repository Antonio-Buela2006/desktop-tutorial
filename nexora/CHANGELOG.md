# Changelog

## 0.23.0 — 2026-11-26
- Ajuda contextual (spec 11) em todas as páginas da aplicação, em PT/EN: botão "?" no topo ou tecla ?, com o que se pode fazer na página, os passos principais e dicas.
- Manual do utilizador (`docs/manuals/user.md` e `user.en.md`) gerado a partir da mesma ajuda (`pnpm --filter @nexora/web manual`), para nunca divergir da aplicação; a integração contínua falha se o manual estiver desatualizado.
- As janelas (modais) passam a ser desenhadas diretamente no corpo da página, para não ficarem cortadas quando abertas a partir do cabeçalho.

## 0.22.0 — 2026-11-26
- Eliminação em lote com pré-visualização (spec 11) em clientes e produtos:
  - seleção de linhas nas tabelas (por linha ou a página inteira) e botão "Eliminar selecionados";
  - pré-visualização por registo antes de confirmar: será eliminado, bloqueado ou ignorado, com avisos (stock existente, compras nos últimos 90 dias); nada é alterado até à confirmação;
  - os registos vão para a lixeira (recuperáveis) e cada um fica auditado; as regras são reavaliadas na transação de aplicação; máximo de 100 registos por operação.
- Produtos em guias de transferência por concluir (pedidas ou em trânsito) já não podem ser eliminados, nem em lote nem um a um, porque a receção deixaria de ser possível.
- Corrigido um teste instável na extração de texto dos PDFs.
- 124 testes.

## 0.21.0 — 2026-11-25
- Aprendizagem contextual por empresa (spec 9.6). A opção já existia nas políticas de IA mas não tinha efeito; agora:
  - com consentimento (opção ligada), a IA dispõe de um perfil de padrões da própria empresa: dia mais forte, produtos principais, recorrência de clientes, melhor e pior mês, produtos no nível de reposição e despesas principais;
  - o assistente dá recomendações personalizadas ("Dá-me recomendações…"); com a opção desligada, explica como a ativar e não usa o histórico;
  - o perfil tem só agregados (sem nomes nem contactos), é calculado no momento e nunca guardado, e respeita a empresa, as permissões e as unidades de quem pergunta;
  - transparência: nas Políticas de IA, "Ver o que a IA aprendeu sobre a empresa" mostra exatamente o perfil usado.
- 122 testes.

## 0.20.0 — 2026-11-25
- Alertas inteligentes (spec 9.5):
  - escalonamento: um alerta importante (aviso ou crítico) que ninguém leu ao fim de N horas (24 por omissão, 0 desliga) sobe aos administradores, também por e-mail, uma só vez por alerta; não pode ser silenciado;
  - destinatários: os alertas podem ser restringidos a funções escolhidas; sem escolha, mantém-se "todas as pessoas com permissão sobre a área"; a permissão continua obrigatória e funções desconhecidas são recusadas;
  - os dois campos estão nas Definições → Alertas inteligentes, em PT/EN.
- 119 testes.

## 0.19.0 — 2026-11-25
- Acessibilidade (spec 11.2, objetivo WCAG 2.2 AA) verificada com axe-core em 50 páginas: site público, aplicação em tema claro e escuro, e portal Nexora. Passou de 57 violações graves para 0:
  - contraste insuficiente: títulos de secção do menu, texto secundário sobre fundos cinzentos, e verde, laranja e vermelho em texto pequeno (claro e escuro);
  - ícone de notificações com nome acessível que inclui o número visível (WCAG 2.5.3);
  - campo da duração do acesso de suporte e escolha do novo administrador principal com etiqueta.
- Novo teste `tests/e2e/a11y.cjs`, que falha com violações graves ou críticas.
- Integração contínua: nova tarefa que arranca a aplicação com dados fictícios e corre os testes no navegador (fluxos principais, inglês e acessibilidade); os testes de navegador passam a falhar quando há erros na página.

## 0.18.0 — 2026-11-25
- Tarefas periódicas seguras com vários processos:
  - corrigido o risco de faturas de renovação duplicadas quando duas execuções corriam em simultâneo; há agora um índice único por empresa e período, e as faturas duplicadas que já existam são marcadas para revisão sem serem apagadas;
  - reposição mensal de créditos de IA e cancelamento de subscrições com atualização condicional, sem movimentos nem auditoria a dobrar;
  - exclusão mútua entre processos com advisory lock do PostgreSQL; as execuções concorrentes ficam como `skipped`.
- Registo de execuções (`job_runs`) e painel no portal Nexora, com aviso quando o worker não corre há demasiado tempo.
- 115 testes.

## 0.17.0 — 2026-11-25
- Rotação da chave de encriptação em repouso sem interrupção:
  - porta-chaves com a chave atual (`ENCRYPTION_KEY`) e as anteriores (`ENCRYPTION_KEYS_PREVIOUS`, só leitura);
  - cada valor encriptado identifica a chave usada (sem a revelar); os valores no formato antigo continuam legíveis;
  - `pnpm keys:rotate` re-encripta os segredos de 2FA (utilizadores e portal Nexora) com a chave atual; é idempotente, não sobrepõe valores alterados entretanto e fica auditado; `--check` só verifica;
  - os backups continuam restauráveis depois de uma rotação, porque são lidos com qualquer chave do porta-chaves.
- Procedimento de rotação documentado em `docs/architecture/deployment.md`.
- 112 testes.

## 0.16.0 — 2026-11-25
- Ordenação por coluna nas tabelas de produtos (SKU, nome, preço, stock, reposição), vendas (número, data, cliente, total), finanças (data, tipo, categoria, valor) e funcionários (nome, função, departamento e, só para quem o pode ver, salário), além dos clientes.
- No servidor, só ordenam colunas de uma lista permitida por tabela; outras são ignoradas (ordem por omissão), com desempate estável entre páginas.
- O salário não é ordenável por quem não tem permissão para o ver, porque a ordem revelaria quem ganha mais.
- 110 testes.

## 0.15.0 — 2026-11-25
- Rastreio distribuído com OpenTelemetry, desligado por omissão e ligado por `OTEL_EXPORTER_OTLP_ENDPOINT` (qualquer coletor OTLP/HTTP; `OTEL_TRACES_EXPORTER=console` para depurar):
  - spans por pedido, hooks e handler (`@fastify/otel` + instrumentação HTTP), propagação W3C `traceparent`;
  - empresa e membro (UUID) no span do pedido; chamada ao fornecedor de IA e cada tarefa automática em spans próprios; erros 5xx registados no span;
  - cabeçalho `x-trace-id` nas respostas para correlacionar erros reportados;
  - amostragem configurável (`OTEL_TRACES_SAMPLER_RATIO`); health e métricas não são rastreados;
  - privacidade: sem corpos, cabeçalhos ou cookies; query string removida e tokens no URL substituídos por `:redacted`.
- Os registos de pedidos do servidor deixam de incluir a query string e os tokens no caminho (antes, por exemplo, o token dos convites ficava no registo).
- 106 testes.

## 0.14.0 — 2026-11-25
- Receção parcial das guias de transferência: indica-se a quantidade recebida por linha (por omissão, tudo).
  - Não se pode receber mais do que foi expedido; uma falta exige motivo.
  - A diferença fica registada como perda em trânsito: auditoria própria (`transfer.discrepancy`, com expedido/recebido/perdido por SKU) e aviso a quem aprova transferências.
  - A lista mostra "Recebida com diferenças" e o recebido/expedido; a guia em PDF inclui a coluna "Recebida" e o motivo.
- 102 testes.

## 0.13.0 — 2026-11-25
- Previsão de rutura de stock (spec 9.8): dias de cobertura, data provável de esgotar e dias até ao nível de reposição por produto, a partir das vendas confirmadas dos últimos 90 dias; respeita o âmbito por unidade. Visível na lista de produtos ("esgota em ~N dias") e no assistente.
- Previsão de tesouraria: receitas, despesas e saldo mensal dos próximos meses, com intervalo de 80% conservador, pressupostos e limitações; só movimentos aprovados. Visível nas Finanças e no assistente.
- Novas ferramentas da IA `forecast_stock` e `forecast_cashflow`, com sugestões no assistente; o assistente local escolhe a previsão conforme a pergunta.
- Endpoints `GET /api/inventory/stock-forecast` e `GET /api/finance/cashflow-forecast` (estatística determinística, sem consumo de créditos).
- 101 testes.

## 0.12.0 — 2026-11-24
- Registo de auditoria em inglês: cada ação tem uma descrição em PT/EN (94 ações); o resumo original continua guardado sem alterações, porque faz parte da cadeia de hash, e fica visível ao passar o rato.
- Nomes das permissões em inglês, aplicados no servidor.
- Nomes e descrições das funções predefinidas em inglês (as funções criadas ou renomeadas pela empresa mantêm o nome escrito).
- Teste que garante que todas as ações de auditoria usadas no código têm descrição nos dois idiomas.
- 97 testes.

## 0.11.0 — 2026-11-24
- Pré-visualização das ações da IA à espera de aprovação no idioma de quem a lê: título, campos com rótulos e impacto (as ações antigas, guardadas com chaves em português, também são apresentadas); ordem fixa dos campos; estados traduzidos.
- A notificação de aprovação da IA passa a dizer quem pediu e o quê, em vez de mostrar dados técnicos.
- PDFs (faturas, guias de transporte e relatórios exportados) no idioma de quem os descarrega.
- Ao mudar de idioma, a interface volta a pedir os dados ao servidor.
- 95 testes.

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
