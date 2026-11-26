**NEXORA**

**ESPECIFICAÇÃO MESTRA DO PRODUTO\
E PLANO DE DESENVOLVIMENTO**

*Plataforma SaaS web de gestão empresarial modular, multiempresa e
assistida por IA*

  -----------------------------------------------------------------------
  **IDENTIFICAÇÃO**                   **VALOR**
  ----------------------------------- -----------------------------------
  Projeto                             Nexora

  Tipo de produto                     Plataforma web SaaS multi-tenant
                                      para pequenas e médias empresas

  Âmbito inicial                      Aplicação web responsiva; API e
                                      arquitetura preparadas para
                                      aplicações móveis futuras

  Ambiente de desenvolvimento         Visual Studio Code com agente de
  pretendido                          programação assistida (assumido:
                                      Claude Code; confirmar se "Cloud
                                      Code" se refere a outra ferramenta)

  Versão do documento                 1.0 --- especificação consolidada a
                                      partir das decisões registadas até
                                      20/11/2026

  Destinatário                        Equipa/empresa de desenvolvimento
                                      responsável por conceber,
                                      implementar, testar e documentar a
                                      Nexora

  Estado                              Documento-base para execução;
                                      pontos explicitamente pendentes
                                      devem ser tratados como
                                      configuração ou decisão de produto,
                                      sem invenção
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  **INSTRUÇÃO PRINCIPAL À EQUIPA ---** Este documento é a fonte de
  requisitos do projeto. Leiam-no integralmente antes de implementar. Não
  construam apenas um protótipo visual: entreguem um produto funcional,
  ligado a uma base de dados, com autenticação, permissões aplicadas no
  servidor, isolamento entre empresas, testes, documentação e instruções
  de execução. Onde existir informação pendente, não inventem factos nem
  bloqueiem todo o trabalho: implementem uma solução configurável e
  documentem claramente o pressuposto adotado.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# CONTROLO DO DOCUMENTO

  -----------------------------------------------------------------------
  **Campo**                           **Descrição**
  ----------------------------------- -----------------------------------
  Objetivo                            Orientar a conceção, arquitetura,
                                      implementação, validação e entrega
                                      da Nexora.

  Público                             Gestor do projeto, analistas,
                                      arquitetos, programadores, UX/UI,
                                      QA, DevOps e responsáveis de
                                      segurança.

  Prioridade de interpretação         Decisões explícitas acordadas
                                      prevalecem sobre recomendações e
                                      pressupostos.

  Gestão de alterações                Toda alteração de requisito deve
                                      ser registada com data, motivo,
                                      impacto, responsável e aprovação.

  Princípio de execução               Desenvolvimento incremental por
                                      fases, com entregáveis
                                      demonstráveis e critérios de
                                      aceitação.
  -----------------------------------------------------------------------

## Legenda do estado dos requisitos

  -----------------------------------------------------------------------
  **Classificação**                   **Significado**
  ----------------------------------- -----------------------------------
  DECIDIDO                            Foi expressamente acordado nas
                                      conversas do projeto; tratar como
                                      requisito.

  RECOMENDADO                         Decisão técnica ou de produto
                                      recomendada para tornar a solução
                                      segura, viável e sustentável.

  PENDENTE / CONFIGURÁVEL             Informação ainda não definida (por
                                      exemplo, preços ou nomes dos 18
                                      módulos); não inventar. Criar
                                      configuração administrativa e
                                      registar o pressuposto.
  -----------------------------------------------------------------------

# ÍNDICE

-   1\. Visão, objetivos e proposta de valor

-   2\. Modelo de negócio e funcionamento SaaS

-   3\. Empresas, contas, funcionários e utilizadores

-   4\. Módulos e contratação modular

-   5\. Planos, limites, preços e subscrições

-   6\. Pagamentos, faturação, atraso e cancelamento

-   7\. Administração da Nexora e administração das empresas

-   8\. Funções, permissões e isolamento multiempresa

-   9\. Inteligência Artificial da Nexora

-   10\. Segurança, privacidade e governação de dados

-   11\. UX/UI e requisitos funcionais transversais

-   12\. Arquitetura técnica recomendada

-   13\. Ferramentas e fluxo de trabalho no VS Code

-   14\. Plano de desenvolvimento por fases

-   15\. Testes, qualidade e critérios de aceitação

-   16\. Infraestrutura, publicação e operação

-   17\. Entregáveis obrigatórios

-   18\. Requisitos pendentes e pressupostos controlados

-   19\. Instruções operacionais para a IA/agente de desenvolvimento

-   20\. Critérios de conclusão e aceitação final

# 1. VISÃO, OBJETIVOS E PROPOSTA DE VALOR

A Nexora é uma plataforma web SaaS de gestão empresarial destinada
principalmente a pequenas e médias empresas. A plataforma disponibiliza
um conjunto de áreas funcionais de gestão, permitindo que cada empresa
escolha e contrate os módulos de que necessita, registe os seus
trabalhadores, atribua contas de acesso e configure permissões.

A Nexora deve centralizar processos empresariais, informação e
indicadores, reduzindo a dispersão por ferramentas isoladas. A
Inteligência Artificial (IA) será uma camada transversal e contextual,
capaz de apoiar análises, recomendações, previsões e execução controlada
de tarefas.

## 1.1 Objetivos do produto

-   Disponibilizar gestão empresarial modular através de subscrição
    SaaS.

-   Permitir que várias empresas utilizem a mesma plataforma com
    isolamento rigoroso dos respetivos dados.

-   Permitir contratação flexível de módulos, funcionários e
    utilizadores adicionais.

-   Oferecer gestão de utilizadores, funções, permissões e aprovações.

-   Incorporar IA geral e assistentes especializados nos módulos.

-   Oferecer dashboards, relatórios, alertas e análise preditiva.

-   Ser acessível através de navegador em computadores, tablets e
    telemóveis.

-   Permitir evolução futura para aplicações móveis através de API
    reutilizável.

## 1.2 Princípios orientadores

-   Segurança e privacidade desde a conceção (security/privacy by
    design).

-   Multi-tenancy seguro: uma empresa nunca acede aos dados de outra.

-   Modularidade comercial sem fragmentar desnecessariamente a
    arquitetura técnica.

-   Experiência simples, consistente e responsiva.

-   IA sujeita às mesmas permissões do utilizador e a aprovações para
    ações sensíveis.

-   Transparência: registos de auditoria e explicabilidade de previsões.

-   Evolução incremental, testada e documentada.

# 2. MODELO DE NEGÓCIO E FUNCIONAMENTO SAAS

A Nexora será um serviço SaaS: a empresa cria uma conta na plataforma,
escolhe um plano, seleciona módulos, define capacidade de trabalhadores
e utilizadores, efetua o pagamento e, após confirmação, a subscrição é
ativada automaticamente.

## 2.1 Jornada principal da empresa

1.  Aceder ao site público da Nexora e iniciar o registo.

2.  Introduzir os dados da empresa e os dados do administrador
    principal.

3.  Selecionar um plano e os módulos pretendidos.

4.  Indicar a capacidade necessária de funcionários registados e de
    utilizadores com conta.

5.  Consultar o resumo comercial, limites, preço, periodicidade e
    condições.

6.  Efetuar o pagamento ou escolher um meio de pagamento disponível.

7.  Após confirmação do pagamento, ativar automaticamente a empresa,
    plano, módulos e limites.

8.  Entrar no painel da empresa, completar a configuração e convidar os
    trabalhadores.

O fluxo deve admitir verificações adicionais de identidade/empresa
quando exigidas por risco, prevenção de fraude ou obrigações legais, sem
obrigar a aprovação manual de todos os registos.

## 2.2 Trial / demonstração gratuita

DECIDIDO: disponibilizar demonstração gratuita de 14 dias, com acesso
amplo à plataforma, dados fictícios, ambiente isolado e sem pagamento
antecipado. RECOMENDADO: não exigir cartão bancário para iniciar o
trial; mostrar avisos antes do fim; permitir conversão para plano pago;
separar claramente dados de demonstração e dados reais; após o prazo,
suspender o ambiente de demonstração e aplicar uma política de retenção
própria, configurável.

## 2.3 Website público e aplicação autenticada

A solução terá uma área pública de apresentação, preços,
funcionalidades, perguntas frequentes, registo e autenticação. Após
login, o utilizador entra na área da sua empresa, com menu e dashboard
adaptados aos módulos e permissões. A equipa da Nexora terá um portal
administrativo separado.

# 3. EMPRESAS, CONTAS, FUNCIONÁRIOS E UTILIZADORES

## 3.1 Separação entre funcionário e utilizador

DECIDIDO: manter dois limites independentes por plano: (1) funcionários
registados na empresa, incluindo pessoas sem conta na plataforma; (2)
utilizadores com conta e acesso à Nexora. Um trabalhador pode existir no
cadastro de RH sem ter credenciais de login.

## 3.2 Administrador principal e administradores secundários

-   Durante o registo, a empresa indica um administrador principal, que
    pode ser proprietário, diretor, responsável de TI ou outra pessoa
    autorizada.

-   Existe um administrador principal por empresa; a transferência desse
    papel exige processo seguro, validação e confirmação.

-   Podem existir administradores secundários em quantidade definida
    pelo plano, com permissões próprias.

-   Administradores secundários não podem transferir a titularidade nem
    substituir o administrador principal sem autorização.

-   Recuperação de conta e transferência administrativa devem possuir
    fluxos seguros, auditáveis e resistentes a abuso.

## 3.3 Utilizadores adicionais e saída de funcionários

A empresa poderá comprar utilizadores adicionais individualmente ou em
pacotes. Ao atingir o limite, a criação de novas contas deve ser
impedida com mensagem clara e opções de comprar capacidade ou fazer
upgrade. As contas existentes continuam a funcionar.

Quando um funcionário sair, a conta deve ser desativada e o acesso
revogado imediatamente. O histórico, documentos e registos de auditoria
devem ser preservados. A vaga de utilizador é libertada para
reutilização. Dados pessoais podem ser atualizados ou anonimizados
conforme a lei e a política de retenção, sem apagar registos que devam
ser conservados.

# 4. MÓDULOS E CONTRATAÇÃO MODULAR

A Nexora prevê 18 áreas/módulos de gestão empresarial, mas os nomes e a
descrição oficial de todos os 18 módulos não estão integralmente
confirmados no registo de decisões disponível para esta especificação. A
equipa não deve inventar a lista definitiva.

  -----------------------------------------------------------------------
  **PONTO PENDENTE CONTROLADO ---** Criar no sistema um catálogo de
  módulos gerido por configuração/administrador da Nexora. Cada módulo
  deve possuir código, nome, descrição, estado (ativo/inativo),
  dependências, preço, requisitos de plano, permissões e navegação. Antes
  de ativar produção comercial, o proprietário do produto deverá
  fornecer/validar a lista oficial dos 18 módulos. A arquitetura e o
  catálogo devem suportar os 18 desde o início.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

## 4.1 Regras de contratação

-   A empresa escolhe os módulos que pretende contratar, dentro das
    regras do plano e das dependências.

-   Cada plano inclui uma franquia/quantidade de módulos; módulos além
    dessa quantidade podem ser comprados como adicionais.

-   Starter, Professional e Enterprise são os nomes de trabalho dos três
    planos.

-   Os números de módulos incluídos em cada plano ainda não foram
    aprovados; não assumir como definitivos valores anteriormente usados
    apenas como exemplos.

-   Nos primeiros 7 dias após a ativação da subscrição inicial, a
    empresa pode trocar módulos sem custo de substituição.

-   Depois dos primeiros 7 dias, as trocas continuam possíveis,
    aplicando cobrança ou crédito proporcional conforme diferença de
    preço e período de faturação.

-   A janela de 7 dias não reinicia em cada troca.

-   Quando um módulo é descontratado, o acesso e as funcionalidades
    ficam bloqueados, mas os dados são preservados. Se o módulo voltar a
    ser contratado, os dados podem ser reativados, respeitando retenção,
    dependências e exportação.

## 4.2 Dependências e consistência

O catálogo deve declarar dependências entre módulos e funcionalidades
partilhadas. O sistema deve impedir desativar um módulo que seja
dependência obrigatória de outro contratado, ou apresentar um plano de
resolução antes de confirmar a alteração. A desativação comercial nunca
deve apagar dados.

# 5. PLANOS, LIMITES, PREÇOS E SUBSCRIÇÕES

DECIDIDO: modelo híbrido com três planos base (Starter, Professional e
Enterprise), com possibilidade de comprar utilizadores adicionais e
módulos adicionais. Cada plano terá limites independentes de
funcionários registados e utilizadores com conta.

## 5.1 Matriz comercial configurável

  -----------------------------------------------------------------------
  **Parâmetro**                       **Estado / orientação**
  ----------------------------------- -----------------------------------
  Nome dos planos                     Starter, Professional, Enterprise
                                      (nomes de trabalho acordados)

  Preço mensal/anual                  PENDENTE: configurar no painel
                                      administrativo; não inventar

  Funcionários incluídos              PENDENTE: valor por plano

  Utilizadores incluídos              PENDENTE: valor por plano

  Administradores secundários         PENDENTE: limite por plano

  Módulos incluídos                   PENDENTE: quantidade por plano

  Módulos adicionais                  Preço e regras configuráveis

  Utilizadores adicionais             Compra individual e em pacotes

  Créditos de IA incluídos            PENDENTE: quantidade por plano e
                                      tabela de custo por operação

  Desconto anual                      RECOMENDADO: configurável, não
                                      fixar sem decisão comercial

  Trial                               14 dias, acesso amplo e dados
                                      fictícios
  -----------------------------------------------------------------------

Todos os limites, preços, franquias, descontos e custos unitários devem
ser configuráveis por administradores autorizados da Nexora, sem
necessidade de alterar código. O histórico de alterações comerciais deve
ser mantido.

## 5.2 Alterações de plano

O sistema deve suportar upgrade e downgrade, com pré-visualização de
impacto, cálculo de diferenças, regras de faturação proporcionais e
aviso sobre limites que possam ser ultrapassados. Um downgrade não deve
apagar dados; se a empresa ficar acima de um limite, deve ser aplicada
uma política explícita (por exemplo, bloquear novas criações até
regularização), sem remover registos existentes.

## 5.3 Estados da subscrição

Modelar estados claros: trial, ativa, em tolerância, somente leitura,
suspensa, cancelada no fim do período, expirada e em processo de
pagamento. Todas as transições devem ser auditáveis e acionadas por
eventos de pagamento, datas e ações administrativas.

# 6. PAGAMENTOS, FATURAÇÃO, ATRASO E CANCELAMENTO

## 6.1 Atraso de pagamento --- regra acordada

  -----------------------------------------------------------------------
  **Período após vencimento**         **Comportamento**
  ----------------------------------- -----------------------------------
  Dias 1--3                           Período de tolerância: acesso
                                      normal e notificações.

  Dias 4--8                           Modo somente leitura: bloquear
                                      criação, edição e operações de
                                      escrita; permitir consulta e
                                      exportação permitida.

  A partir do dia 9                   Suspender a subscrição e o acesso
                                      operacional; preservar os dados.
  -----------------------------------------------------------------------

Após confirmação do pagamento, restaurar o plano, permissões e acesso
aplicáveis. A implementação deve considerar atrasos de confirmação do
gateway, pagamentos manuais e reconciliação.

## 6.2 Pagamentos e integração

Para o mercado angolano, preparar uma camada de pagamentos desacoplada
que permita integrar fornecedores compatíveis com Multicaixa Express,
transferências bancárias e cartões/gateways. A escolha do prestador deve
ser precedida de validação comercial, técnica, contratual e de
segurança. Não guardar dados completos de cartões. Usar webhooks
assinados, idempotência, reconciliação e registos de transação.

## 6.3 Faturação

-   Histórico de faturas, recibos, pagamentos e créditos/débitos.

-   Estados de fatura: rascunho, emitida, paga, parcialmente paga,
    vencida, anulada ou reembolsada, conforme aplicável.

-   Moeda, impostos, numeração e formato fiscal devem ser configuráveis
    conforme enquadramento legal aplicável em Angola e mercados futuros.

-   A equipa deverá validar requisitos fiscais com
    contabilista/consultor local antes de produção.

## 6.4 Cancelamento e retenção

DECIDIDO: a empresa pode cancelar a qualquer momento e mantém acesso até
ao fim do período pago. Depois, o acesso operacional é suspenso. A
empresa deve poder solicitar/exportar os seus dados em formato
utilizável. Os dados serão conservados por um prazo e depois eliminados
ou anonimizados conforme obrigações legais.

RECOMENDADO COMO VALOR INICIAL CONFIGURÁVEL: retenção de 90 dias após o
fim do período pago, antes da eliminação/anonimização, exceto dados
sujeitos a retenção legal, litígio, auditoria ou obrigação contratual. O
prazo final deve ser aprovado juridicamente e publicado na política de
privacidade.

## 6.5 Exportação de dados

Disponibilizar exportação por módulo e exportação global, em formatos
abertos e utilizáveis (CSV/XLSX para dados tabulares, PDF para
relatórios/documentos, e pacote estruturado/JSON quando adequado).
Exportações devem respeitar permissões, registar auditoria, ser
protegidas por link temporário e não incluir dados aos quais o
solicitante não tem acesso.

# 7. ADMINISTRAÇÃO DA NEXORA E ADMINISTRAÇÃO DAS EMPRESAS

## 7.1 Portal administrativo global

Criar portal separado para a equipa da Nexora, com autenticação
reforçada, RBAC administrativo e trilho de auditoria. Funcionalidades:
empresas, subscrições, planos, módulos, preços, pagamentos, créditos IA,
métricas agregadas, suporte, incidentes, configurações globais,
integrações, monitorização e auditoria.

## 7.2 Painel da empresa

Cada empresa terá painel para gerir os seus utilizadores, funcionários,
funções, permissões, módulos contratados, subscrição, pagamentos,
consumo de IA, alertas, integrações e configurações. Os dados
apresentados devem ser sempre limitados ao tenant da sessão.

## 7.3 Suporte técnico excecional

DECIDIDO: técnicos da Nexora não têm acesso livre aos dados
empresariais. O acesso a conteúdo para suporte deve ser excecional,
autorizado pela empresa, limitado ao necessário e ao tempo definido, com
registo de quem acedeu, motivo, âmbito, início e fim. Sempre que
possível, usar logs técnicos e dados anonimizados. Criar mecanismo de
acesso temporário de suporte (break-glass) apenas para emergências
documentadas, com aprovação e revisão posterior.

# 8. FUNÇÕES, PERMISSÕES E ISOLAMENTO MULTIEMPRESA

## 8.1 Modelo de permissões

DECIDIDO: controlo de acesso combinado baseado em funções (RBAC), com
funções predefinidas, funções personalizadas e ajustes por utilizador.
Exemplos de funções: diretor-geral, gestor de RH, contabilista, gestor
financeiro, gestor de stock, comercial, vendedor e funcionário.

As permissões devem ser granulares: visualizar, criar, editar, eliminar,
aprovar, exportar, configurar e consultar relatórios. Acesso a um módulo
não significa acesso automático a todas as operações desse módulo.

## 8.2 Regras de autorização

-   Validar permissões no servidor/API em todas as operações; ocultar
    botões no frontend não é controlo de segurança suficiente.

-   Permitir acesso temporário a funções/permissões para substituições,
    com data de início, fim e auditoria.

-   Aplicar segregação de funções para operações críticas, evitando que
    o mesmo utilizador solicite e aprove a própria operação quando a
    política exigir dupla validação.

-   Administradores secundários podem gerir apenas o âmbito que lhes foi
    concedido.

-   Aplicar princípio do menor privilégio por defeito.

## 8.3 Multi-tenancy obrigatório

Cada empresa é um tenant. Todos os registos empresariais devem estar
associados a um tenant_id (ou mecanismo equivalente) e todas as
consultas, comandos, jobs, ficheiros, caches, pesquisas e relatórios
devem aplicar o contexto do tenant no servidor. É proibido confiar num
tenant_id enviado livremente pelo cliente. A API deve obter o tenant do
contexto autenticado e validar a associação do utilizador.

Implementar testes automatizados de isolamento horizontal e vertical,
incluindo tentativas de acesso a IDs pertencentes a outro tenant.
Considerar políticas de segurança ao nível da base de dados (por
exemplo, Row-Level Security, quando suportado e bem implementado).

# 9. INTELIGÊNCIA ARTIFICIAL DA NEXORA

A IA é uma capacidade transversal da Nexora, composta por um assistente
geral e assistentes especializados integrados nos módulos. Deve ser
implementada como camada independente dos fornecedores/modelos, para
permitir substituição de modelos sem reconstruir os módulos.

## 9.1 Acesso da IA aos dados --- decisão acordada

Cada empresa poderá configurar o nível de acesso da IA. Opções
conceptuais: acesso restrito; acesso personalizado por
módulos/categorias; acesso geral aos dados da própria empresa. Mesmo no
modo geral, a IA não pode ultrapassar o isolamento entre empresas, as
restrições de dados sensíveis, as permissões aplicáveis e os controlos
de aprovação.

Regra de implementação segura: a IA herda sempre as permissões do
utilizador que faz o pedido e as políticas da empresa. A opção de acesso
geral significa que a empresa pode permitir contexto transversal aos
módulos, mas não autoriza a IA a revelar dados a utilizadores sem
permissão. O administrador principal define a política global;
administradores secundários só alteram o que lhes for delegado.

## 9.2 Administração da IA

DECIDIDO: administradores configuram o que a IA pode ou não fazer. O
administrador principal controla a política global, podendo delegar
configurações específicas a administradores secundários. Funcionários
comuns utilizam a IA sem alterar as políticas gerais.

Existirão dois níveis de configuração: (1) painel central de IA, com
política global, acesso a dados, autonomia, créditos, idiomas, alertas,
auditoria e assistentes; (2) configurações específicas dentro de cada
módulo. As configurações de módulo nunca podem ultrapassar as restrições
centrais.

## 9.3 Autonomia e aprovações

DECIDIDO: a IA pode executar automaticamente tarefas simples
autorizadas; ações importantes ou sensíveis exigem aprovação humana por
pessoa com permissão adequada.

  -----------------------------------------------------------------------
  **Tipo de ação**                    **Comportamento recomendado**
  ----------------------------------- -----------------------------------
  Consulta, pesquisa e resumo de      Automático, respeitando permissões.
  dados autorizados                   

  Relatórios, organização e análises  Automático; registar atividade.

  Atualizações simples e reversíveis  Automático apenas quando permitido
                                      pela política; registar e permitir
                                      rastreio.

  Pagamentos, transferências e        Aprovação humana obrigatória; dupla
  movimentos financeiros              aprovação quando configurada.

  Salários e dados laborais sensíveis Aprovação humana e permissões
                                      específicas.

  Lançamentos/alterações              Aprovação humana; guardar
  contabilísticas relevantes          justificação e evidências.

  Eliminação definitiva, cancelamento Confirmação explícita e aprovação
  ou ação irreversível                adequada.

  Alteração de permissões, políticas  Aprovação administrativa reforçada.
  de IA ou dados críticos             
  -----------------------------------------------------------------------

A IA deve apresentar pré-visualização do que pretende executar, impacto
esperado, dados utilizados e possibilidade de cancelar antes da
aprovação. Não deve executar novamente uma ação por repetição de webhook
ou pedido duplicado (idempotência).

## 9.4 Auditoria da IA --- decisão acordada

Manter histórico de pedidos, contexto consultado (metadados e
referências necessárias, sem copiar dados sensíveis desnecessariamente),
análises, recomendações, operações propostas e executadas,
aprovações/recusas, utilizador solicitante, aprovador, data/hora,
resultado e identificador da operação. Proteger os registos contra
alteração indevida, controlar acesso e definir retenção.

## 9.5 Alertas inteligentes e notificações

DECIDIDO: a IA poderá detetar problemas e oportunidades e enviar
notificações no sistema e, quando configurado, por e-mail ou outros
canais integrados. Exemplos: stock baixo, despesas anormais, pagamentos
atrasados, queda de vendas, prazos próximos e tendências relevantes.
Administradores configuram tipos de alerta, destinatários, canais,
limiares, frequência, horário de silêncio e escalonamento. Evitar
excesso de notificações e permitir desativar alertas.

## 9.6 Aprendizagem contextual por empresa

DECIDIDO: a IA deverá adaptar análises e recomendações ao histórico e
aos padrões de cada empresa. Implementar aprendizagem contextual isolada
por tenant, com consentimento/configuração e controlos de privacidade.
Não assumir que é necessário treinar um modelo próprio desde o início:
começar por contexto recuperável, indicadores e histórico autorizado;
evoluir para modelos preditivos quando houver dados suficientes. Não
utilizar dados de uma empresa para revelar informação a outra.

## 9.7 Interfaces e idiomas

DECIDIDO: interação por texto, voz e assistentes contextuais integrados
nos módulos. A experiência inicial deve suportar português e inglês, com
arquitetura preparada para outros idiomas. Cada empresa escolhe idiomas
disponíveis e cada utilizador seleciona o seu idioma preferido. A
disponibilidade de voz depende dos fornecedores e navegadores
suportados; fornecer alternativa textual.

## 9.8 Inteligência preditiva e simulação

DECIDIDO: previsões, recomendações e simulações de cenários. Exemplos:
previsão de stock, vendas, despesas, tesouraria, atrasos de clientes e
tendências; simulação de aumento de custos ou alteração de preços. As
previsões devem indicar período, dados utilizados, pressupostos,
limitações, intervalo/nível de confiança quando tecnicamente válido.
Nunca apresentar estimativas como certezas nem tomar decisões críticas
autonomamente.

## 9.9 Créditos de IA

-   Cada plano inclui uma quantidade mensal de créditos de IA; valores
    ainda pendentes.

-   Empresas podem comprar pacotes adicionais ou fazer upgrade.

-   Consumo calculado por operação, com tabela de custos configurável.

-   Dashboard mostra saldo, consumo, histórico, alertas e previsão de
    esgotamento.

-   Ao esgotar créditos, bloquear novas operações que consumam créditos
    e avisar; funcionalidades normais sem IA continuam disponíveis.

-   Não efetuar cobranças automáticas de créditos adicionais sem
    autorização explícita.

-   Registar consumo por utilizador, módulo, operação, modelo/fornecedor
    e tenant.

## 9.10 Segurança e qualidade da IA

-   Tratar conteúdo fornecido por utilizadores/documentos como dados,
    nunca como instruções de sistema.

-   Proteger contra prompt injection, fuga de dados, chamadas de
    ferramentas não autorizadas e execução fora do âmbito.

-   Usar ferramentas com lista permitida e autorização no servidor; não
    dar acesso direto irrestrito à base de dados ao modelo.

-   Aplicar validação de entradas e saídas, limites de contexto, rate
    limits e proteção de dados pessoais.

-   Manter separação de contexto por tenant e por utilizador.

-   Exigir confirmação humana para ações sensíveis e manter trilho de
    auditoria.

-   Permitir desativar IA globalmente ou por módulo e aplicar fallback
    quando o fornecedor estiver indisponível.

# 10. SEGURANÇA, PRIVACIDADE E GOVERNAÇÃO DE DADOS

## 10.1 Autenticação

DECIDIDO: e-mail e palavra-passe, 2FA opcional por empresa, com
compatibilidade com aplicações autenticadoras como Google Authenticator
e Microsoft Authenticator. A empresa pode exigir 2FA a todos ou a
determinadas funções. Recomenda-se exigir 2FA para administradores e
utilizadores com acesso a dados sensíveis. Disponibilizar códigos de
recuperação protegidos.

## 10.2 Dispositivos e sessões

DECIDIDO: mostrar dispositivos e sessões ativos, permitir terminar
sessões remotamente, definir limites de dispositivos, encerrar sessões
por inatividade e alertar sobre novos dispositivos ou acessos suspeitos.
Configurações por empresa, com políticas mínimas globais de segurança.

## 10.3 Backups e recuperação

DECIDIDO: backups automáticos, redundantes e encriptados, com versões e
recuperação. Realizar cópias várias vezes ao dia conforme criticidade e
capacidade técnica, monitorizar sucesso/falha e testar restauração
periodicamente. Definir RPO e RTO por criticidade antes de produção. Uma
restauração deve preservar o isolamento entre tenants.

## 10.4 Proteção contra ataques

DECIDIDO: monitorização contínua, deteção de comportamento anormal,
bloqueio/limitação de tentativas suspeitas, alertas e resposta
automática. Implementar proteção contra vulnerabilidades comuns (OWASP
Top 10), incluindo SQL Injection, XSS, CSRF, SSRF, falhas de controlo de
acesso, exposição de segredos e abuso de API. Usar WAF/rate limiting
quando adequado.

## 10.5 Dados, retenção e eliminação

DECIDIDO: eliminar primeiro para área recuperável; período inicial
recomendado de 30 dias, configurável por tipo de registo e política
legal. Manter histórico de alterações e eliminar definitivamente apenas
com regras de retenção e autorizações adequadas. Registos
financeiros/contabilísticos sujeitos a obrigação legal não podem ser
apagados antes do prazo aplicável. Disponibilizar mecanismo de legal
hold quando necessário.

## 10.6 Acesso técnico e privacidade

O acesso da equipa técnica da Nexora ao conteúdo dos clientes é
excecional e exige autorização, finalidade, âmbito e tempo limitado, com
auditoria. Dados devem ser encriptados em trânsito e em repouso.
Segredos e credenciais nunca devem ser guardados no repositório. Aplicar
minimização de dados, classificação de informação e política de
retenção.

## 10.7 Conformidade

A equipa deve identificar e validar os requisitos legais e fiscais
aplicáveis à operação em Angola e a quaisquer países onde a Nexora venha
a atuar. Não declarar conformidade legal sem avaliação profissional.
Preparar políticas de privacidade, termos de serviço, política de
cookies, política de retenção, acordos de tratamento de dados e
procedimento de resposta a incidentes.

# 11. UX/UI E REQUISITOS FUNCIONAIS TRANSVERSAIS

-   Design profissional, consistente, acessível e responsivo.

-   Dashboard por função, com indicadores e atalhos relevantes.

-   Menu dinâmico apenas com módulos contratados e autorizados.

-   Pesquisa global respeitando permissões e tenant.

-   Tabelas com paginação, ordenação, filtros, pesquisa e exportação
    autorizada.

-   Formulários com validação, mensagens de erro úteis e prevenção de
    perda acidental.

-   Estados claros: carregamento, vazio, erro, sucesso, sem permissão,
    módulo não contratado e subscrição suspensa.

-   Notificações centralizadas, preferências e histórico.

-   Modo claro/escuro, acessibilidade por teclado e contraste adequado.

-   Idioma por utilizador e formatação de datas/números/moeda
    configurável.

-   Confirmação para ações destrutivas e pré-visualização para operações
    em lote.

-   Ajuda contextual, onboarding e demonstração com dados fictícios.

## 11.1 Site público

Criar páginas: início, funcionalidades, módulos, planos/preços,
segurança/privacidade, sobre, contacto/suporte, FAQ, registo, login e
termos/políticas. Conteúdo comercial deve ser administrável ou
facilmente editável. Não apresentar funcionalidades ainda não lançadas
como disponíveis.

## 11.2 Acessibilidade e desempenho

Adotar boas práticas WCAG 2.2 AA como objetivo, otimizar carregamento,
dividir bundles, paginar resultados, evitar consultas pesadas e
monitorizar Core Web Vitals. Testar em navegadores modernos e resoluções
comuns.

# 12. ARQUITETURA TÉCNICA RECOMENDADA

A escolha final da stack deve ser validada pela equipa, mas a
recomendação para uma primeira versão robusta, produtiva e compreensível
é uma arquitetura modular, com tecnologias maduras e documentação ampla.

## 12.1 Stack de referência recomendada

  -------------------------------------------------------------------------
  **Camada**              **Recomendação de         **Justificação /
                          referência**              alternativa**
  ----------------------- ------------------------- -----------------------
  Frontend                Next.js + React +         Aplicação web moderna,
                          TypeScript                SSR quando útil,
                                                    ecossistema amplo.

  UI                      Tailwind CSS + biblioteca Consistência e rapidez
                          acessível (por exemplo,   sem sacrificar controlo
                          shadcn/ui)                visual.

  Backend/API             NestJS + TypeScript (ou   Domínios claros,
                          módulos backend no        validação, guards,
                          Next.js apenas se escopo  serviços e
                          muito controlado)         escalabilidade.

  Base de dados           PostgreSQL                Relacional, transações,
                                                    integridade, extensões
                                                    e RLS quando aplicável.

  ORM/migrations          Prisma ou Drizzle         Escolher um, padronizar
                                                    migrations e não
                                                    misturar ORMs.

  Cache/filas             Redis + BullMQ (ou        Jobs, notificações,
                          serviço gerido            tarefas de IA e
                          equivalente)              operações demoradas.

  Ficheiros               Object storage compatível Documentos privados,
                          com S3                    URLs assinados e
                                                    lifecycle.

  Autenticação            Solução madura            Escolher conforme
                          (Auth.js/Clerk/Supabase   controlo, custos e
                          Auth ou equivalente)      suporte a
                                                    organizações/2FA.

  IA                      Camada de orquestração    Evitar dependência
                          própria + APIs de         rígida de um único
                          fornecedores              modelo.

  Testes                  Vitest/Jest, Playwright,  Unitários, integração e
                          testes API                E2E.

  Observabilidade         OpenTelemetry +           Métricas, tracing, logs
                          plataforma de logs/erros  e alertas.

  Deploy                  Docker + CI/CD + cloud    Ambientes reproduzíveis
                          gerida                    e rollback.
  -------------------------------------------------------------------------

  -----------------------------------------------------------------------
  **DECISÃO DE ARQUITETURA ---** Começar como monólito modular (ou
  aplicação modular com serviços bem separados), não como microserviços
  distribuídos. Separar domínios e contratos internos para permitir
  extração futura apenas quando escala, equipa ou carga justificar.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

## 12.2 Domínios/módulos de backend

-   Identity & Access: autenticação, utilizadores, funções, permissões,
    sessões e 2FA.

-   Tenant & Company: empresas, configurações, unidades/filiais e
    isolamento.

-   Subscription & Billing: planos, limites, subscrições, pagamentos e
    faturas.

-   Module Catalog: catálogo, contratação, dependências e entitlement.

-   Audit & Compliance: auditoria, retenção, exportação e legal hold.

-   Notification: preferências, canais, templates e filas.

-   AI Platform: contexto, políticas, créditos, assistentes, aprovações
    e auditoria.

-   Business Modules: os 18 domínios empresariais, implementados por
    prioridade após validação da lista oficial.

-   Admin & Support: painel Nexora, suporte temporário e operações
    administrativas.

## 12.3 Modelo de dados --- entidades mínimas

Desenhar ERD e migrations antes de codificar regras críticas. Entidades
indicativas (ajustar sem perder requisitos): Tenant/Company,
CompanyProfile, User, Employee, Membership, Role, Permission,
RolePermission, UserPermissionOverride, Session, Device, ModuleCatalog,
TenantModule, Plan, PlanLimit, Subscription, SubscriptionItem, AddOn,
Payment, Invoice, AIWallet, AICreditTransaction, AIPolicy, AIAssistant,
AIAction, AIApproval, AuditEvent, Notification, NotificationPreference,
FileAsset, ExportJob, SupportAccessGrant, Backup/Restore metadata.

Todos os dados de negócio devem estar ligados ao tenant. Utilizadores
podem pertencer a mais de uma empresa apenas se o produto suportar
explicitamente memberships múltiplos; cada sessão/contexto deve
selecionar um tenant e nunca misturar contextos.

## 12.4 Requisitos de API

-   Versionar APIs públicas e documentá-las com OpenAPI/Swagger.

-   Validar autenticação, tenant, função, permissão, estado da
    subscrição e módulo contratado em cada endpoint.

-   Aplicar rate limits, idempotência em pagamentos e operações
    sensíveis, paginação e validação de schemas.

-   Não expor segredos nem dados internos; respostas de erro não devem
    revelar existência de recursos de outro tenant.

-   Webhooks assinados e reprocessamento seguro.

-   Registar correlação/trace ID em pedidos e jobs.

# 13. FERRAMENTAS E FLUXO DE TRABALHO NO VS CODE

O ambiente indicado pelo proprietário do projeto é Visual Studio Code
ligado a uma ferramenta referida como "Cloud Code". Para este documento,
assume-se provisoriamente que se refere a um agente de programação como
Claude Code integrado no VS Code. Se "Cloud Code" significar a extensão
Google Cloud Code, esta é sobretudo orientada a desenvolvimento/deploy
em Google Cloud e não substitui, por si só, um agente de programação. A
equipa deve confirmar o produto exato antes de configurar o ambiente,
sem bloquear a definição arquitetural.

## 13.1 Ferramentas recomendadas

  -----------------------------------------------------------------------
  **Ferramenta**                      **Utilização**
  ----------------------------------- -----------------------------------
  Visual Studio Code                  Editor principal, terminal
                                      integrado, Git, depuração e
                                      extensões.

  Agente de programação (Claude Code  Análise do repositório,
  ou equivalente confirmado)          implementação assistida, testes,
                                      refatoração e documentação. Deve
                                      trabalhar por tarefas pequenas e
                                      com revisão humana.

  Git + GitHub/GitLab                 Versionamento, branches, pull
                                      requests, revisão e histórico.

  Node.js LTS + pnpm                  Runtime e gestão de dependências
                                      JavaScript/TypeScript.

  Docker Desktop                      Ambiente local reproduzível para
                                      PostgreSQL, Redis e serviços
                                      auxiliares.

  PostgreSQL                          Base de dados local e produção.

  Prisma/Drizzle CLI                  Migrations, schema e acesso tipado
                                      à base de dados.

  Postman/Insomnia ou Bruno           Testar APIs; manter coleção
                                      versionada.

  Playwright                          Testes de ponta a ponta no
                                      navegador.

  ESLint + Prettier + TypeScript      Qualidade, formatação e prevenção
  strict                              de erros.

  GitHub Actions/GitLab CI            Lint, typecheck, testes, build e
                                      deploy controlado.

  Sentry/OpenTelemetry ou equivalente Erros, logs, tracing e
                                      monitorização.

  Figma (opcional, recomendado)       Fluxos, wireframes e sistema visual
                                      antes da implementação de
                                      interfaces complexas.
  -----------------------------------------------------------------------

## 13.2 Regras para trabalhar com o agente de programação

-   Antes de escrever código, o agente deve ler este documento,
    inspecionar o repositório e apresentar um plano de implementação e
    riscos.

-   Não gerar toda a aplicação num único passo. Trabalhar por fases,
    módulos e tarefas pequenas, com critérios de aceitação.

-   Antes de alterar ficheiros críticos, explicar o impacto e manter
    alterações versionadas.

-   Não inventar nomes dos 18 módulos, preços, limites ou requisitos
    legais. Usar placeholders/configuração e manter lista de decisões
    pendentes.

-   Não colocar segredos, tokens ou passwords no código ou em commits.
    Usar .env local e secret manager em produção.

-   Não desativar testes nem reduzir segurança para fazer o build
    passar.

-   Depois de cada tarefa: executar lint, typecheck, testes relevantes e
    build; corrigir falhas antes de avançar.

-   Manter README atualizado, decisões arquiteturais (ADR), changelog e
    documentação de API.

-   Gerar código legível e explicar as decisões para que os estudantes
    possam compreender e defender o sistema.

-   Não declarar tarefa concluída sem demonstrar comportamento funcional
    e evidência de teste.

## 13.3 Estrutura inicial sugerida do repositório

nexora/\
apps/\
web/ \# aplicação web e portais\
api/ \# API/backend (se separado)\
worker/ \# jobs assíncronos\
packages/\
ui/ \# componentes partilhados\
config/ \# configuração e tooling\
types/ \# tipos e contratos\
auth/ \# utilitários de identidade/autorização\
database/\
schema/\
migrations/\
seeds/\
docs/\
architecture/\
adr/\
api/\
security/\
product/\
infra/\
docker/\
deployment/\
monitoring/\
tests/\
e2e/\
integration/\
.env.example\
docker-compose.yml\
README.md

## 13.4 Ambientes

Manter ambientes local, development/staging e production separados.
Dados de produção nunca devem ser copiados para desenvolvimento sem
anonimização e autorização. Usar migrations versionadas, seeds
fictícias, feature flags e rollback de deploy. Acesso de produção
limitado e auditado.

# 14. PLANO DE DESENVOLVIMENTO POR FASES

Recomenda-se execução faseada. Cada fase deve terminar com uma versão
executável, demonstração, testes e documentação. A sequência abaixo
reduz riscos: primeiro fundações multi-tenant e segurança; depois
subscrição e catálogo; depois módulos de negócio; por fim IA avançada e
escala.

  -----------------------------------------------------------------------
  **Fase**                **Âmbito**              **Entregável / gate de
                                                  saída**
  ----------------------- ----------------------- -----------------------
  0 --- Descoberta e      Validar módulos,        Especificação refinada,
  desenho                 personas, fluxos,       backlog priorizado,
                          riscos, arquitetura,    wireframes, ADRs, ERD e
                          UX, modelo comercial e  plano de testes.
                          requisitos legais.      

  1 --- Fundação técnica  Repo, CI, ambientes,    Login funcional;
                          design system, base de  criação/seleção de
                          dados, logging,         empresa; testes de
                          autenticação, tenants,  isolamento e permissões
                          RBAC, auditoria.        aprovados.

  2 --- SaaS e            Site público,           Registo e ativação de
  administração           onboarding, planos      empresa; gestão de
                          configuráveis, catálogo plano/módulos/limites
                          de módulos, limites,    em ambiente de teste.
                          subscrições, trial,     
                          painel Nexora.          

  3 --- Plataforma        Dashboard,              Fluxos empresariais
  empresarial base        funcionários,           base funcionais e
                          utilizadores, convites, auditados.
                          funções, sessões,       
                          notificações, ficheiros 
                          e exportação.           

  4 --- Módulos           Implementar os 18       Cada módulo ligado à
  empresariais            módulos conforme lista  base de dados,
                          validada, por           permissões, relatórios,
                          prioridade e            testes e documentação.
                          dependências.           

  5 --- Billing e         Gateways, webhooks,     Ciclo de subscrição
  operação comercial      faturas, reconciliação, validado de ponta a
                          atraso,                 ponta em sandbox.
                          upgrade/downgrade,      
                          cancelamento e          
                          créditos.               

  6 --- IA inicial segura Assistente geral,       IA responde e executa
                          contexto autorizado,    ações permitidas em
                          políticas, créditos,    ambiente controlado,
                          logs, aprovações e      com auditoria.
                          notificações.           

  7 --- IA avançada       Assistentes por módulo, Capacidades avançadas
                          voz, multilingue,       testadas, com limites,
                          previsões, simulações e métricas e fallback.
                          aprendizagem            
                          contextual.             

  8 --- Hardening e       Pentest/revisão,        Release candidate,
  lançamento              desempenho,             evidência de segurança,
                          acessibilidade,         plano de operação e
                          backups/restores, DR,   checklist de
                          políticas, suporte,     lançamento.
                          observabilidade.        

  9 --- Evolução contínua Integrações, app móvel  Roadmap contínuo com
                          futura, novos idiomas,  métricas e releases
                          novos relatórios e      controladas.
                          otimização.             
  -----------------------------------------------------------------------

## 14.1 Prioridade de lançamento

Recomendação: lançar um MVP comercial controlado apenas quando o núcleo
multi-tenant, autenticação, RBAC, catálogo, subscrições, pagamentos,
auditoria, backups e os módulos prioritários estiverem estáveis. Não
lançar 18 módulos incompletos. É preferível entregar módulos completos
por ondas, mantendo a arquitetura pronta para todos os 18.

## 14.2 Gestão do backlog

Cada item do backlog deve conter: identificador, objetivo, descrição,
utilizador/persona, critérios de aceitação, dependências, risco,
prioridade, estimativa, testes e estado. Usar épicos, histórias e
tarefas técnicas. Priorizar segurança e fundações antes de
funcionalidades visuais.

## 14.3 Definition of Done

-   Código revisto e integrado na branch principal por pull request.

-   Lint, typecheck, testes relevantes e build sem falhas.

-   Permissões e tenant validados no servidor.

-   Auditoria implementada quando aplicável.

-   Tratamento de erros, loading e estados vazios.

-   Documentação e migrations atualizadas.

-   Critérios de aceitação demonstrados.

-   Sem segredos ou dados reais expostos.

# 15. TESTES, QUALIDADE E CRITÉRIOS DE ACEITAÇÃO

## 15.1 Estratégia de testes

  -----------------------------------------------------------------------
  **Tipo**                            **O que validar**
  ----------------------------------- -----------------------------------
  Unitários                           Regras de negócio, cálculos,
                                      limites, permissões e transições de
                                      estado.

  Integração                          API, base de dados, filas,
                                      pagamentos sandbox, storage,
                                      notificações e IA.

  E2E                                 Registo, onboarding, contratação,
                                      login, uso de módulos, faturação,
                                      cancelamento e exportação.

  Segurança                           Autenticação, 2FA, RBAC, isolamento
                                      tenant, injection, CSRF, XSS, rate
                                      limit, upload e segredos.

  Desempenho                          Dashboards, pesquisas, relatórios,
                                      jobs, concorrência e limites de
                                      carga.

  Recuperação                         Restaurar backups e validar
                                      integridade e isolamento.

  UX/acessibilidade                   Responsividade, navegação por
                                      teclado, contraste, formulários e
                                      mensagens.

  IA                                  Permissões, prompt injection, fuga
                                      de dados, aprovação, idempotência,
                                      créditos e qualidade das respostas.
  -----------------------------------------------------------------------

## 15.2 Critérios mínimos de aceitação global

-   Uma empresa não consegue consultar ou alterar dados de outra, mesmo
    manipulando URLs, IDs ou pedidos API.

-   Um utilizador sem permissão não consegue executar a ação no
    servidor, mesmo chamando diretamente a API.

-   Uma empresa não consegue usar módulos que não contratou, exceto
    demonstração explicitamente configurada.

-   Os limites de funcionários e utilizadores são aplicados
    separadamente.

-   Quando o limite de utilizadores é atingido, novas contas são
    bloqueadas sem afetar as existentes.

-   A saída de um funcionário revoga acesso e liberta a vaga, mantendo
    histórico.

-   Atrasos de pagamento respeitam os períodos 1--3, 4--8 e a partir do
    dia 9.

-   Cancelamento mantém acesso até ao fim do período pago e permite
    exportação segundo permissões.

-   A IA não executa ações sensíveis sem aprovação adequada.

-   Todas as ações relevantes da IA e ações administrativas ficam
    auditadas.

-   Créditos esgotados bloqueiam apenas operações de IA, não os módulos
    normais.

-   Backups podem ser restaurados e a restauração é testada.

-   Site e painéis são responsivos e têm estados de erro/carregamento
    adequados.

# 16. INFRAESTRUTURA, PUBLICAÇÃO E OPERAÇÃO

## 16.1 Recomendação de hosting

Escolher fornecedor cloud após comparar preço, região, latência para
Angola, suporte, backups, segurança, escalabilidade, custos de tráfego e
requisitos de residência de dados. Não fixar fornecedor antes de estimar
carga e orçamento. Preferir serviços geridos para PostgreSQL, object
storage, backups e observabilidade quando o custo for viável.

## 16.2 Componentes de produção

-   Domínio e DNS com TLS/HTTPS obrigatório.

-   Frontend e API com deploy automatizado e rollback.

-   PostgreSQL gerido, backups e monitorização.

-   Redis/filas, storage privado e CDN quando necessário.

-   WAF/rate limiting e proteção de endpoints.

-   Secret manager e rotação de credenciais.

-   Logs centralizados, métricas, tracing e alertas.

-   Ambientes staging e produção separados.

-   Plano de recuperação de desastre e contactos de escalonamento.

## 16.3 Operação

Definir responsáveis por incidentes, suporte, backups, faturação e
alterações de produção. Monitorizar disponibilidade, erros, latência,
jobs pendentes, pagamentos falhados, consumo de IA, tentativas suspeitas
e capacidade da base de dados. Mudanças de produção devem ter revisão,
janela, plano de rollback e registo.

# 17. ENTREGÁVEIS OBRIGATÓRIOS

-   Repositório completo com código-fonte e histórico Git.

-   Aplicação web responsiva e funcional.

-   Backend/API funcional e documentado.

-   Schema da base de dados, ERD e migrations.

-   Seeds com dados fictícios e instruções para reset local.

-   Autenticação, 2FA, RBAC e isolamento multi-tenant.

-   Portal administrativo global da Nexora.

-   Painel e onboarding de empresas.

-   Catálogo e contratação modular configuráveis.

-   Planos, limites, subscrições, pagamentos e faturação.

-   Módulos empresariais conforme lista oficial validada.

-   IA geral e assistentes especializados conforme fases contratadas.

-   Auditoria, notificações, exportação, retenção e backups.

-   Testes unitários, integração, E2E e segurança, com relatórios.

-   Documentação de arquitetura, decisões (ADRs), API e modelo de dados.

-   README de instalação e execução local no VS Code.

-   .env.example sem segredos.

-   Docker Compose ou instruções equivalentes para ambiente local.

-   Pipeline CI/CD e instruções de deploy.

-   Manual de administrador, manual de utilizador e guia de suporte.

-   Lista de limitações conhecidas, riscos e funcionalidades não
    implementadas.

# 18. REQUISITOS PENDENTES E PRESSUPOSTOS CONTROLADOS

Os pontos seguintes não devem ser inventados. A equipa deverá preparar o
sistema para configuração e assinalar o que precisa de aprovação antes
de comercialização ou produção.

  -----------------------------------------------------------------------
  **Ponto pendente**                  **Tratamento recomendado**
  ----------------------------------- -----------------------------------
  Lista oficial e nomes dos 18        Solicitar ao proprietário do
  módulos                             produto; manter catálogo
                                      configurável e arquitetura
                                      preparada.

  Preços dos planos e adicionais      Não definir por conta própria;
                                      manter painel comercial
                                      configurável.

  Limites por plano: funcionários,    Propor cenários para aprovação;
  utilizadores e administradores      aplicar via configuração.

  Quantidade de módulos incluídos em  Configurar por plano após decisão
  cada plano                          comercial.

  Créditos mensais IA e custo por     Medir consumo real em testes;
  operação                            propor tabela transparente e
                                      configurável.

  Gateway e prestadores de pagamento  Validar disponibilidade, custos,
                                      API, contrato e sandbox em Angola.

  Moeda, impostos e documentos        Validar com contabilista/consultor
  fiscais                             local; preparar multi-moeda se
                                      necessário.

  Retenção pós-cancelamento           90 dias como proposta inicial
                                      configurável; validação legal
                                      obrigatória.

  Cloud Code / Claude Code            Confirmar ferramenta exata; adaptar
                                      instruções de ambiente sem alterar
                                      requisitos do produto.

  Fornecedor cloud, domínio e         Comparar opções e apresentar
  orçamento                           estimativa de custo mensal e plano
                                      de crescimento.

  Políticas legais e privacidade      Revisão profissional para Angola e
                                      outros mercados de operação.

  Canais além de e-mail e             Selecionar integrações
  notificações internas               (SMS/WhatsApp/push) após validar
                                      custo, consentimento e fornecedor.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  **REGRA PARA NÃO BLOQUEAR O PROJETO ---** A equipa pode avançar com
  arquitetura, protótipos funcionais, dados de demonstração e parâmetros
  configuráveis. Não pode ativar preços, condições fiscais, nomes
  oficiais de módulos ou políticas legais como definitivos sem validação
  do proprietário do produto. Entregar uma lista objetiva de decisões
  necessárias e continuar o trabalho não dependente delas.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# 19. INSTRUÇÕES OPERACIONAIS PARA A IA / AGENTE DE DESENVOLVIMENTO

As instruções seguintes destinam-se a ser copiadas como briefing inicial
para o agente de programação no VS Code. A equipa pode adaptar comandos
e estrutura à ferramenta efetivamente instalada, mantendo os princípios
e critérios deste documento.

## 19.1 Prompt de arranque

És o arquiteto de software e engenheiro principal responsável por
construir a Nexora, uma plataforma SaaS web de gestão empresarial
multiempresa, modular e assistida por IA. Este documento é a
especificação de produto e a fonte de verdade dos requisitos.\
\
Antes de implementar:\
1. Lê integralmente esta especificação e inspeciona o repositório,
ferramentas, versões e ambiente.\
2. Confirma se o ambiente usa Claude Code ou Google Cloud Code; não
confundas um agente de programação com uma extensão de cloud/deploy.\
3. Produz um plano técnico faseado, arquitetura, ERD, ameaças
principais, backlog e critérios de aceitação.\
4. Identifica os requisitos pendentes da secção 18 e propõe defaults
configuráveis, sem inventar decisões comerciais ou legais.\
5. Não comeces por construir apenas o frontend nem por gerar tudo num
único passo.\
\
Implementa incrementalmente, por fases, começando pela fundação
multi-tenant, autenticação, RBAC, auditoria e testes de isolamento. Usa
arquitetura modular e tecnologias maduras. Toda autorização deve ser
validada no servidor. Todas as operações de negócio devem respeitar
tenant, permissões, subscrição e módulo contratado. Não confies em
tenant_id enviado pelo cliente.\
\
Para cada tarefa:\
- descreve objetivo, ficheiros afetados e riscos;\
- implementa apenas o escopo acordado;\
- cria/atualiza migrations e testes;\
- executa lint, typecheck, testes e build;\
- corrige falhas antes de avançar;\
- atualiza README, documentação e ADRs;\
- apresenta o que ficou funcional e evidências de teste.\
\
Não coloques segredos no código. Usa .env.example. Não uses dados reais
em seeds. Não desatives controlos de segurança para contornar erros. Não
declares funcionalidades como concluídas se forem apenas mockups, dados
estáticos ou botões sem ação.\
\
A entrega final deve incluir código-fonte, base de dados/migrations,
aplicação executável, testes, documentação, instruções VS Code,
configuração de ambiente, CI/CD e instruções de deploy. Mantém uma lista
explícita de funcionalidades concluídas, incompletas, limitações e
decisões pendentes. Pede aprovação humana antes de operações de
produção, custos, migrações destrutivas ou ações irreversíveis.

## 19.2 Primeira sequência de trabalho exigida

9.  Fazer inventário do repositório e verificar versões/ambiente.

10. Apresentar arquitetura proposta e ADRs iniciais.

11. Desenhar modelo de dados e ERD multi-tenant.

12. Definir threat model e matriz RBAC inicial.

13. Configurar monorepo, TypeScript strict, lint, formatter, CI e Docker
    local.

14. Implementar autenticação, tenants, memberships, roles e permissions.

15. Escrever testes negativos de isolamento entre empresas antes de
    adicionar módulos de negócio.

16. Construir o primeiro fluxo vertical completo (registo de empresa →
    plano de teste → dashboard → utilizadores/permissões).

17. Depois avançar para catálogo de módulos, subscrições, billing e
    módulos empresariais.

18. Integrar IA apenas depois de políticas de autorização, auditoria,
    créditos e aprovação estarem implementadas.

# 20. CRITÉRIOS DE CONCLUSÃO E ACEITAÇÃO FINAL

A Nexora só deve ser considerada entregue quando os fluxos contratados
estiverem implementados de ponta a ponta, com dados persistidos,
validação no servidor, testes, documentação e demonstração. Uma
interface visual sem backend real, dados estáticos, operações simuladas
ou permissões apenas no frontend não satisfaz este documento.

-   Executa localmente no ambiente documentado e em ambiente de staging.

-   Build reproduzível a partir de instruções limpas.

-   Autenticação, recuperação de conta, 2FA e sessões funcionais.

-   Isolamento multi-tenant comprovado por testes.

-   RBAC aplicado a endpoints, páginas, ficheiros, pesquisas, relatórios
    e jobs.

-   Planos, limites, módulos e subscrições aplicados de forma
    consistente.

-   Fluxos de pagamento validados em sandbox e com reconciliação.

-   Regras de atraso, cancelamento, exportação e retenção demonstradas.

-   IA limitada por permissões, com créditos, aprovação e auditoria.

-   Backups e recuperação demonstrados em ambiente de teste.

-   Testes automatizados aprovados e relatório de segurança entregue.

-   Manuais e documentação atualizados.

-   Lista de riscos e pendências aprovada pelo proprietário do produto.

# ANEXO A --- MATRIZ CONSOLIDADA DE DECISÕES ACORDADAS

  -----------------------------------------------------------------------
  **Tema**                            **Decisão consolidada**
  ----------------------------------- -----------------------------------
  Produto                             Site/plataforma web SaaS
                                      responsiva; mobile app poderá vir
                                      depois.

  Modelo                              Multiempresa, planos híbridos e
                                      contratação modular.

  Planos                              Starter, Professional, Enterprise;
                                      limites e preços ainda por definir.

  Capacidade                          Limites independentes de
                                      funcionários e utilizadores com
                                      login.

  Adicionais                          Utilizadores adicionais
                                      individualmente ou em pacotes;
                                      módulos adicionais.

  Limite de utilizadores              Bloquear novas contas; oferecer
                                      compra adicional ou upgrade; manter
                                      contas existentes.

  Saída de funcionário                Desativar acesso, preservar
                                      histórico e libertar vaga.

  Módulos                             18 áreas previstas; empresa
                                      escolhe; 7 dias iniciais para troca
                                      sem custo; depois ajuste
                                      proporcional.

  Módulo cancelado                    Bloquear funcionalidades, preservar
                                      dados e permitir reativação.

  Atraso                              Dias 1--3 normal; 4--8 somente
                                      leitura; dia 9 em diante suspensão.

  Cancelamento                        A qualquer momento; acesso até ao
                                      fim do período pago; exportação e
                                      retenção posterior.

  Registo                             Empresa escolhe
                                      plano/módulos/capacidade, paga e
                                      ativa automaticamente após
                                      confirmação.

  Administrador                       Um principal; secundários com
                                      permissões; transferência segura.

  Permissões                          RBAC predefinido e personalizado,
                                      granular e validado no servidor.

  Trial                               14 dias, acesso amplo, dados
                                      fictícios, isolado e sem pagamento
                                      antecipado.

  IA                                  Assistente geral e especializados;
                                      acesso configurável pela empresa.

  Autonomia IA                        Tarefas simples autorizadas
                                      automáticas; ações sensíveis exigem
                                      aprovação.

  Créditos IA                         Franquia mensal, pacotes
                                      adicionais/upgrade; sem cobrança
                                      automática não autorizada.

  IA e permissões                     IA nunca contorna permissões do
                                      utilizador nem isolamento entre
                                      empresas.

  Administração IA                    Administradores controlam;
                                      principal tem controlo global e
                                      delega limites.

  Auditoria IA                        Registar pedidos, contexto,
                                      recomendações, ações, aprovações e
                                      responsáveis.

  Notificações IA                     Sistema, e-mail e outros canais
                                      configurados.

  Aprendizagem IA                     Contextual por empresa, isolada e
                                      protegida.

  Interação IA                        Texto, voz e assistentes integrados
                                      nos módulos.

  Idiomas IA                          Português e inglês inicialmente;
                                      preparada para outros; preferência
                                      por utilizador.

  IA preditiva                        Previsões, recomendações e
                                      simulações de cenários.

  Painel IA                           Painel central e configurações
                                      específicas por módulo.

  Autenticação                        E-mail/password e 2FA
                                      opcional/configurável;
                                      autenticadores TOTP.

  Sessões                             Dispositivos, encerramento remoto,
                                      limites, expiração e alertas.

  Backups                             Automáticos, redundantes,
                                      encriptados, versões e testes de
                                      recuperação.

  Cibersegurança                      Monitorização, deteção anómala,
                                      proteção contra ataques e resposta.

  Acesso técnico                      Acesso excecional com autorização,
                                      âmbito, tempo limitado e auditoria.

  Eliminação                          Área recuperável, período inicial
                                      recomendado 30 dias, retenção e
                                      eliminação controladas.
  -----------------------------------------------------------------------

# ANEXO B --- RECOMENDAÇÕES DE EXECUÇÃO PARA O PROPRIETÁRIO DO PROJETO

-   Guardar este documento no repositório em
    /docs/product/Nexora_Master_Specification.docx e manter uma versão
    Markdown para controlo de alterações.

-   Não enviar apenas o documento ao agente e pedir "faz tudo"; iniciar
    pela Fase 0 e aprovar os artefactos de arquitetura e backlog.

-   Exigir demonstrações regulares no navegador e testes, não apenas
    relatórios de progresso.

-   Manter decisões de negócio sob controlo do proprietário do produto;
    delegar decisões técnicas dentro dos limites desta especificação.

-   Validar com profissionais locais os requisitos fiscais, pagamentos,
    proteção de dados e contratos antes de aceitar clientes reais.

-   Usar dados fictícios durante desenvolvimento e demonstração.

-   Não lançar comercialmente antes de concluir revisão de segurança,
    recuperação de backups, termos e política de privacidade.
