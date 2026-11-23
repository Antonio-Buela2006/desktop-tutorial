# Matriz RBAC inicial

Gerada a partir de `apps/api/src/core/permissions.ts` (fonte de verdade). ✔ = concedida pela função predefinida. O **administrador principal** tem todas as permissões. Permissões marcadas *admin* só são efetivas para administradores (principal ou secundário com a função). Permissões de módulo só têm efeito se o módulo estiver contratado. As funções predefinidas podem ser editadas por cada empresa; podem ser criadas funções personalizadas e ajustes por utilizador (conceder/negar, com validade).

| Permissão | Módulo | Administrador | Diretor-geral | Gestor de RH | Contabilista | Gestor financeiro | Gestor de stock | Comercial | Vendedor | Funcionário |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `dashboard.view` Ver dashboard | núcleo | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `users.view` Ver utilizadores | núcleo | ✔ | ✔ | ✔ |  |  |  |  |  |  |
| `users.invite` Convidar utilizadores | núcleo | ✔ |  |  |  |  |  |  |  |  |
| `users.edit` Editar utilizadores e funções atribuídas | núcleo | ✔ |  |  |  |  |  |  |  |  |
| `users.disable` Desativar utilizadores | núcleo | ✔ |  |  |  |  |  |  |  |  |
| `roles.view` Ver funções | núcleo | ✔ | ✔ |  |  |  |  |  |  |  |
| `roles.manage` Criar e editar funções e permissões *(admin)* | núcleo | ✔ |  |  |  |  |  |  |  |  |
| `employees.view` Ver funcionários | núcleo | ✔ | ✔ | ✔ |  |  |  |  |  |  |
| `employees.create` Registar funcionários | núcleo |  |  | ✔ |  |  |  |  |  |  |
| `employees.edit` Editar funcionários | núcleo |  |  | ✔ |  |  |  |  |  |  |
| `employees.delete` Eliminar funcionários | núcleo |  |  | ✔ |  |  |  |  |  |  |
| `employees.offboard` Registar saída de funcionários | núcleo |  |  | ✔ |  |  |  |  |  |  |
| `employees.view_salary` Ver salários (dado sensível) | núcleo |  |  | ✔ |  |  |  |  |  |  |
| `employees.export` Exportar funcionários | núcleo |  |  | ✔ |  |  |  |  |  |  |
| `billing.view` Ver subscrição e faturas | núcleo | ✔ | ✔ |  |  | ✔ |  |  |  |  |
| `billing.manage` Alterar plano, módulos e pagar *(admin)* | núcleo |  |  |  |  |  |  |  |  |  |
| `settings.manage` Configurar empresa e segurança *(admin)* | núcleo | ✔ |  |  |  |  |  |  |  |  |
| `audit.view` Consultar auditoria | núcleo | ✔ | ✔ |  |  |  |  |  |  |  |
| `trash.manage` Restaurar registos eliminados | núcleo | ✔ |  |  |  |  |  |  |  |  |
| `support.grant` Autorizar acesso temporário de suporte *(admin)* | núcleo |  |  |  |  |  |  |  |  |  |
| `ai.use` Utilizar o assistente de IA | núcleo | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `ai.configure` Configurar políticas de IA *(admin)* | núcleo |  |  |  |  |  |  |  |  |  |
| `ai.approve` Aprovar ações propostas pela IA | núcleo | ✔ | ✔ |  |  | ✔ | ✔ |  |  |  |
| `reports.view` Consultar relatórios e previsões | núcleo | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |
| `crm.view` Ver clientes | crm |  | ✔ |  |  |  |  | ✔ | ✔ |  |
| `crm.create` Criar clientes | crm |  | ✔ |  |  |  |  | ✔ | ✔ |  |
| `crm.edit` Editar clientes | crm |  | ✔ |  |  |  |  | ✔ |  |  |
| `crm.delete` Eliminar clientes | crm |  | ✔ |  |  |  |  | ✔ |  |  |
| `crm.export` Exportar clientes | crm |  | ✔ |  |  |  |  | ✔ |  |  |
| `inventory.view` Ver produtos e stock | inventory |  | ✔ |  |  |  | ✔ | ✔ | ✔ |  |
| `inventory.create` Criar produtos | inventory |  | ✔ |  |  |  | ✔ |  |  |  |
| `inventory.edit` Editar produtos | inventory |  | ✔ |  |  |  | ✔ |  |  |  |
| `inventory.delete` Eliminar produtos | inventory |  | ✔ |  |  |  | ✔ |  |  |  |
| `inventory.adjust` Ajustar stock | inventory |  | ✔ |  |  |  | ✔ |  |  |  |
| `inventory.export` Exportar stock | inventory |  | ✔ |  |  |  | ✔ |  |  |  |
| `sales.view` Ver vendas | sales |  | ✔ |  | ✔ | ✔ | ✔ | ✔ | ✔ |  |
| `sales.create` Registar vendas | sales |  | ✔ |  |  |  |  | ✔ | ✔ |  |
| `sales.cancel` Anular vendas | sales |  | ✔ |  |  |  |  |  |  |  |
| `sales.export` Exportar vendas | sales |  | ✔ |  |  |  |  | ✔ |  |  |
| `finance.view` Ver movimentos financeiros | finance |  | ✔ |  | ✔ | ✔ |  |  |  |  |
| `finance.create` Registar movimentos | finance |  | ✔ |  | ✔ | ✔ |  |  |  |  |
| `finance.edit` Editar movimentos | finance |  | ✔ |  | ✔ | ✔ |  |  |  |  |
| `finance.delete` Eliminar movimentos | finance |  | ✔ |  |  | ✔ |  |  |  |  |
| `finance.approve` Aprovar movimentos financeiros | finance |  | ✔ |  |  | ✔ |  |  |  |  |
| `finance.export` Exportar movimentos | finance |  | ✔ |  | ✔ | ✔ |  |  |  |  |

