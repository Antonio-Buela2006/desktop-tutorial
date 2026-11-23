# Limitações conhecidas e funcionalidades não implementadas

Transparência exigida pela especificação (§17, §20). Lista honesta do estado atual:

1. **Módulos de negócio**: implementados 4 de 18 (nomes provisórios). Os restantes aguardam a lista oficial.
2. **Pagamentos reais**: apenas fornecedor sandbox e transferência com reconciliação manual. Multicaixa Express
   e gateways de cartão não estão integrados (camada pronta: `provider` + webhook assinado).
3. **Faturação fiscal**: documentos não são certificados fiscalmente; sem PDF de fatura (dados disponíveis via API/JSON).
4. **Exportação**: CSV e JSON. XLSX e PDF ainda não (formatos abertos alternativos disponíveis).
5. **E-mail**: transporte "console" em desenvolvimento; integrar fornecedor real.
6. **RLS no PostgreSQL**: não ativado (isolamento aplicado e testado na aplicação) — ver ADR-0003.
7. **Filas**: jobs em processo/worker sem Redis/BullMQ (ADR-0004).
8. **Ficheiros/documentos**: sem armazenamento de ficheiros (object storage S3) nesta versão.
9. **IA**: previsões por regressão linear simples (com intervalos e limitações explícitas); aprendizagem
   contextual limita-se a usar o histórico da própria empresa; sem modelos preditivos treinados.
   Voz depende do suporte do navegador (Web Speech API), com alternativa textual.
10. **Observabilidade**: logs estruturados com request id; OpenTelemetry/Sentry por integrar.
11. **Backups/DR**: dependem da infraestrutura escolhida; restauro não testado nesta entrega.
12. **i18n**: navegação e IA em PT/EN; a maior parte dos textos de ecrã está em português.
13. **Site público**: SPA sem SSR (SEO limitado) — ADR-0001.
14. **Unidades/filiais** dentro de uma empresa: não modeladas ainda.
