# Decisões pendentes e pressupostos controlados (§18)

Nada abaixo foi inventado como definitivo: o sistema é configurável e os valores atuais são
**valores de teste** marcados como tal (`commercial_confirmed = false`, módulos `provisional`).

| Ponto pendente | Estado no sistema | Ação necessária do proprietário |
| --- | --- | --- |
| Lista oficial e nomes dos 18 módulos | Catálogo com 18 entradas: 4 implementadas com nomes provisórios (Clientes/CRM, Stock, Vendas, Finanças) e 14 "Módulo NN — por definir" (não contratáveis) | Fornecer/validar lista, nomes, descrições, dependências e prioridade de implementação |
| Preços dos planos e adicionais | Valores de teste para sandbox; site público mostra "Preço a definir" | Aprovar preços (mensal/anual) e preços de utilizador/módulo adicional |
| Limites por plano (funcionários, utilizadores, admins, módulos incluídos) | Valores de teste aplicados (Starter 10/3/1/2 · Professional 50/15/3/3 · Enterprise 500/100/10/4) | Aprovar valores |
| Créditos IA mensais e custo por operação | Teste: 200/1000/5000 créditos; custos chat 1, leitura 1, escrita 2, previsão 3 | Medir consumo real e aprovar tabela |
| Desconto anual | Implícito no preço anual configurável (teste = 10 meses) | Aprovar política |
| Gateway de pagamentos (Angola) | Camada desacoplada; sandbox e transferência bancária ativos; Multicaixa Express desativado | Escolher prestador após validação comercial/técnica/contratual; dados bancários |
| Moeda, impostos e documentos fiscais | AOA, taxa 0% configurável; numeração `NX-AAAAMM-…` | Validar com contabilista local (IVA, faturação certificada AGT) |
| Retenção pós-cancelamento | 90 dias (parâmetro `retention`), lixeira 30 dias, finanças nunca purgadas automaticamente | Validação jurídica e publicação na política de privacidade |
| Textos legais | Versões provisórias assinaladas no site | Revisão profissional (Angola e mercados de operação) |
| Canais além de e-mail/in-app | E-mail via transporte configurável ("console" em dev) | Escolher fornecedor de e-mail e eventuais SMS/WhatsApp/push |
| Fornecedor cloud, domínio, orçamento | Docker + compose prontos para qualquer cloud | Comparar fornecedores (latência para Angola, residência de dados, custo) |
| "Cloud Code" vs Claude Code | Desenvolvimento feito com Claude Code | Confirmar ferramenta da equipa |
| RPO/RTO e política de backups | Recomendações no guia de deploy | Definir por criticidade |
