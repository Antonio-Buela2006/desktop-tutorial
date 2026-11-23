# Changelog

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
