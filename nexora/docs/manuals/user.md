# Manual do utilizador

> Gerado a partir da ajuda contextual da aplicação (botão "?" ou tecla ? em cada página). Não editar à mão: altere `apps/web/src/lib/help.ts` e corra `pnpm --filter @nexora/web manual`.

## Geral

- **Entrar**: e-mail e palavra-passe; com 2FA, introduza o código da aplicação autenticadora.
- **Menu**: mostra apenas os módulos contratados e as áreas a que tem acesso.
- **Pesquisa global** (topo): clientes, produtos e pessoas que pode ver.
- **Tabelas**: pesquisa, ordenação por coluna e paginação; as ações aparecem conforme as suas permissões.
- **Idioma e tema**: PT/EN e modo claro/escuro no topo; o idioma fica guardado na conta.
- **Ajuda**: botão "?" no topo ou tecla ? para a ajuda da página atual.

## Dashboard

`/app` — Resumo do negócio: vendas do mês, stock baixo, resultado financeiro e clientes. Só aparecem os indicadores dos módulos contratados e a que tem acesso.

**Como fazer**

1. Escolha uma unidade no seletor para ver só os números dessa unidade.
2. Veja o gráfico "Vendas por mês" e a lista "Produtos a repor" (stock atual / nível de reposição).
3. Siga o guia "Primeiros passos" até estar concluído.

**Bom saber**

- Os números de vendas excluem as vendas anuladas.
- Utilizadores restritos a unidades veem apenas as suas unidades.

## Clientes

`/app/customers` — Cadastro de clientes e contactos comerciais.

**Como fazer**

1. "Novo cliente" para criar; o lápis edita e o caixote move para a lixeira.
2. "Importar CSV" carrega muitos clientes de uma vez, com pré-visualização linha a linha antes de gravar.
3. Selecione várias linhas e use "Eliminar selecionados" para eliminar em lote, com pré-visualização.
4. O clipe anexa documentos ao cliente.

**Bom saber**

- Clique nos cabeçalhos "Nome" e "Criado" para ordenar.
- Os clientes eliminados podem ser restaurados na Lixeira durante o prazo configurado.

## Stock e inventário

`/app/products` — Produtos, stock por localização (armazém central e unidades), ajustes e guias de transferência.

**Como fazer**

1. "Novo produto" para criar; o ícone de caixa ajusta o stock com motivo obrigatório.
2. "Movimentos" mostra o histórico de entradas e saídas.
3. Separador "Guias de transferência": "Nova guia" pede uma transferência; outra pessoa aprova e expede; o destino confirma a receção, indicando o que chegou.
4. Se chegar menos do que foi expedido, indique o motivo: a diferença fica registada como perda em trânsito.

**Bom saber**

- "esgota em ~N dias" é uma estimativa a partir das vendas dos últimos 90 dias.
- Produtos em guias por concluir não podem ser eliminados.
- Cada guia tem uma guia de transporte em PDF.

## Vendas

`/app/sales` — Registo de vendas com baixa automática de stock da unidade da venda.

**Como fazer**

1. "Nova venda": escolha o cliente (opcional), os produtos e as quantidades.
2. Uma venda pode ser anulada; o stock é reposto na mesma localização.
3. Use o seletor de unidade para filtrar.

**Bom saber**

- Não é possível vender mais do que o stock disponível na localização.
- As vendas não substituem faturação fiscal certificada (pendente de validação local).

## Finanças

`/app/finance` — Receitas e despesas, com aprovação por outra pessoa a partir do limite configurado, e previsão de tesouraria.

**Como fazer**

1. "Novo movimento" regista uma receita ou despesa.
2. Despesas acima do limite ficam "Por aprovar": outra pessoa com permissão aprova ou rejeita.
3. Abra "Previsão de tesouraria" para ver receitas, despesas e saldo estimados dos próximos meses.

**Bom saber**

- Quem registou uma despesa não a pode aprovar (segregação de funções).
- A previsão é uma estimativa com intervalo, não uma certeza.
- Movimentos financeiros não são eliminados definitivamente (obrigação legal).

## Funcionários

`/app/employees` — Cadastro das pessoas da empresa, independente das contas de acesso.

**Como fazer**

1. "Novo funcionário" para registar; o salário só é visível e ordenável para quem tem essa permissão.
2. Registe a saída de um funcionário: o acesso associado é revogado e a vaga libertada, mantendo o histórico.
3. Anexe documentos com o clipe.

**Bom saber**

- Os limites de funcionários e de utilizadores do plano são contados em separado.

## Utilizadores

`/app/users` — Contas com acesso à Nexora, as suas funções, permissões e unidades.

**Como fazer**

1. "Convidar" envia um convite por e-mail (válido 7 dias).
2. A chave abre os acessos: funções (também temporárias, com data de fim), ajustes de permissões e restrição a unidades.
3. Desativar revoga o acesso de imediato e liberta a vaga.

**Bom saber**

- Quando o limite de utilizadores é atingido, não é possível convidar, mas as contas existentes continuam.

## Funções e permissões

`/app/roles` — Funções predefinidas e personalizadas, com permissões granulares validadas no servidor.

**Como fazer**

1. "Nova função" cria uma função com as permissões escolhidas.
2. O lápis edita; as funções predefinidas também podem ser ajustadas.

**Bom saber**

- Permissões de módulos não contratados não têm efeito.
- Permissões administrativas só valem para administradores.

## Subscrição e faturação

`/app/billing` — Plano, módulos, capacidade, faturas e pagamentos.

**Como fazer**

1. Altere o plano ou os módulos: a pré-visualização mostra o valor proporcional antes de confirmar.
2. Pague uma fatura em aberto pelo método disponível.
3. Pode agendar o cancelamento para o fim do período pago e revertê-lo antes disso.

**Bom saber**

- Atraso de pagamento: dias 1–3 acesso normal, 4–8 só leitura, a partir do 9.º suspensão; os dados ficam preservados.
- Os pagamentos reais (ex.: Multicaixa Express) ainda não estão integrados.

## Definições da empresa

`/app/settings` — Dados da empresa, segurança, alertas, unidades, titularidade e acesso de suporte.

**Como fazer**

1. Segurança: exigir 2FA, sessão inativa, dispositivos por utilizador, prazo da lixeira e idioma por omissão.
2. Alertas inteligentes: tipos, limiares, e-mail para críticos, escalonamento aos administradores e destinatários por função.
3. Unidades e filiais: crie e desative unidades.
4. Suporte Nexora: autorize acesso temporário, com motivo, âmbito e duração.

**Bom saber**

- A transferência da administração principal exige confirmação de quem a recebe.

## Assistente IA

`/app/ai` — Assistente com as suas permissões e as políticas da empresa. Ações sensíveis exigem aprovação humana.

**Como fazer**

1. Escreva ou dite uma pergunta, ou use uma sugestão (resumo, stock baixo, previsões, simulação de preço).
2. Aprovações: ações propostas pela IA aguardam aprovação de outra pessoa.
3. Créditos e consumo: saldo, histórico e previsão de esgotamento.
4. Políticas de IA (administradores): acesso aos dados, autonomia, módulos, alertas e aprendizagem contextual.

**Bom saber**

- Com a aprendizagem contextual ligada, peça "recomendações" baseadas no histórico da empresa.
- Sem créditos, só a IA fica bloqueada; o resto da Nexora continua a funcionar.

## Auditoria

`/app/audit` — Registo das ações relevantes de utilizadores, sistema, IA e suporte Nexora, encadeado por hash.

**Como fazer**

1. Filtre por origem ou pesquise.
2. "Cadeia íntegra" confirma que nenhum registo foi alterado ou apagado.

**Bom saber**

- Os registos não podem ser editados nem apagados.

## Exportar dados

`/app/exports` — Exportação em formatos abertos (CSV, JSON, XLSX, PDF), respeitando as suas permissões.

**Como fazer**

1. Escolha os conjuntos de dados e o formato.
2. Descarregue o ficheiro pelo link (de validade limitada).

**Bom saber**

- Cada exportação fica registada na auditoria.
- Após o cancelamento, a exportação continua disponível durante o período de retenção.

## Lixeira

`/app/trash` — Registos eliminados, recuperáveis durante o prazo configurado.

**Como fazer**

1. "Restaurar" devolve o registo ao seu lugar.

**Bom saber**

- Após o prazo, a eliminação é definitiva, exceto registos financeiros com obrigação legal ou sob retenção legal.

## Notificações

`/app/notifications` — Alertas do sistema e da IA, no idioma escolhido.

**Como fazer**

1. Marque como lidas; abra a ligação para ir ao sítio certo.
2. "As minhas preferências": silenciar tipos, e-mail e horário de silêncio.

**Bom saber**

- Segurança, faturação, incidentes e escalonamentos não podem ser silenciados.

## Segurança da conta

`/app/security` — Palavra-passe, autenticação de dois fatores e sessões ativas.

**Como fazer**

1. Ative o 2FA com uma aplicação autenticadora (Google ou Microsoft Authenticator) e guarde os códigos de recuperação.
2. Termine sessões em dispositivos que não reconhece.
3. Altere a palavra-passe: as outras sessões são terminadas.

**Bom saber**

- É avisado quando há acesso a partir de um novo dispositivo.
