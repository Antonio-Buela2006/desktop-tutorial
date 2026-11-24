# Limitações conhecidas e funcionalidades não implementadas

Transparência exigida pela especificação (§17, §20). Lista honesta do estado atual:

1. **Módulos de negócio**: implementados 4 de 18 (nomes provisórios). Os restantes aguardam a lista oficial.
2. **Pagamentos reais**: apenas fornecedor sandbox e transferência com reconciliação manual. Multicaixa Express
   e gateways de cartão não estão integrados (camada pronta: `provider` + webhook assinado).
3. **Faturação fiscal**: as faturas têm PDF informativo, mas não são certificadas fiscalmente (AGT) — pendente de validação local.
4. **Exportação**: CSV, JSON, XLSX e PDF disponíveis. O relatório PDF mostra até 7 colunas e 500 linhas por conjunto (dados completos em XLSX/CSV).
5. **E-mail**: SMTP suportado (`MAIL_TRANSPORT=smtp`); falta escolher o fornecedor e configurar o domínio (SPF/DKIM).
6. **RLS no PostgreSQL**: ativo como segunda barreira (ADR-0003) em todas as tabelas com `tenant_id`. Ficam fora, por atravessarem empresas por natureza: rotas de identidade (`/api/auth/*`), portal Nexora, webhooks e jobs, que continuam protegidos pela aplicação. Tabelas globais (utilizadores, planos) não têm RLS. Cada pedido de empresa ocupa uma ligação do pool enquanto dura (`DB_POOL_MAX`).
7. **Filas**: jobs em processo/worker sem Redis/BullMQ (ADR-0004).
8. **Ficheiros/documentos**: documentos de funcionários e clientes com armazenamento local ou S3. Antivírus ClamAV suportado (`CLAMAV_HOST`), com falha fechada; é preciso disponibilizar o serviço clamd na infraestrutura.
9. **IA**: previsões por regressão linear simples (com intervalos e limitações explícitas); aprendizagem
   contextual limita-se a usar o histórico da própria empresa; sem modelos preditivos treinados.
   Voz depende do suporte do navegador (Web Speech API), com alternativa textual.
10. **Observabilidade**: logs estruturados com request id e métricas Prometheus em `/api/metrics`; tracing OpenTelemetry e captura de erros (Sentry) por integrar.
11. **Backups/DR**: `pnpm backup` cria cópias encriptadas e `pnpm backup:verify` restaura e valida automaticamente (testado). Falta agendar na infraestrutura escolhida e replicar para outra região; RPO/RTO por definir.
12. **i18n**: a interface (site público, entrada, painel e portal) e a IA estão em PT e EN, com a preferência guardada na conta. Ficam em português os textos gerados pelo servidor (notificações, resumos de auditoria, nomes do catálogo) e algumas frases com valores dinâmicos; as mensagens de erro conhecidas são traduzidas pelo código. Para acrescentar um idioma basta um dicionário como `apps/web/src/lib/en.ts`.
13. **Site público**: SPA sem SSR (SEO limitado) — ADR-0001.
14. **Unidades/filiais**: funcionários, vendas e finanças têm unidade, e os utilizadores podem ser restringidos a unidades (verificado no servidor). Há stock por unidade e armazém central, com guias de transferência (aprovação, trânsito, receção e guia em PDF). A guia é um documento interno: o modelo fiscal de guia de transporte em Angola está pendente de validação. Cada unidade conta como um único armazém e não há receção parcial.
