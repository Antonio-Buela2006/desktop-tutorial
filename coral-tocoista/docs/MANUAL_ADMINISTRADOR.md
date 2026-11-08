# Manual do Administrador

Manual curto para o **Administrador Geral** do Sistema de Gestão do Grupo Coral e dos Fazedores de Cultura.

## 1. Primeiros passos

1. Abra o link do sistema (ex.: `https://o-seu-dominio/entrar`) e introduza o seu telefone.
2. Escreva o código de 6 dígitos que chega pelo WhatsApp.
3. Preencha o cadastro. **O primeiro número cadastrado fica Administrador Geral.**
4. Em **Configurações**:
   - confirme o nome da instituição e do grupo;
   - ajuste a validade do código (por omissão 5 minutos);
   - em **Listas parametrizáveis**, introduza as **paróquias** reais e confirme as áreas, vozes, categorias, coros e cargos.
5. Copie o **link de cadastro** e partilhe-o no grupo de WhatsApp dos membros.

## 2. Perfis de acesso

| Perfil | O que pode fazer |
|---|---|
| **Administrador Geral** | Tudo: membros, perfis, cargos, bloqueios, eliminação, listas, configurações, relatórios e auditoria. |
| **Responsável do Coro** | Consulta todos os membros, edita as fichas dos coristas, vê o dashboard, o organograma e os relatórios. Não mexe em listas, perfis, cargos nem bloqueios. |
| **Corista/Membro** | Vê e edita apenas a sua própria ficha. Não consegue mudar o próprio perfil, cargos ou estado. |

Para promover alguém a Responsável do Coro: **Membros › Ver › Perfil e cargos › Perfil de acesso**.

## 3. Membros

- **Pesquisar:** escreva parte do nome ou do telefone.
- **Filtros:** paróquia, área, coro, voz, cargo, categoria cultural, perfil e bloqueados.
- **Ver ficha:** dados pessoais, religiosos e corais, cargos, categorias, data do consentimento e última entrada.
- **Editar ficha:** botão *Editar ficha*. As regras aplicam-se sempre:
  - nome, telefone e área são obrigatórios;
  - coro, tipo de voz e data de ingresso só são obrigatórios para coristas;
  - quem é corista recebe automaticamente a categoria e o cargo "Corista";
  - a data de baptismo só é guardada se a pessoa for baptizada.
- **Perfil e cargos:** marque os cargos (um membro pode ter vários) e grave. O organograma actualiza-se logo.
- **Bloquear:** o membro perde a sessão imediatamente e deixa de receber códigos. *Desbloquear* repõe o acesso.
- **Eliminar:** é definitivo. Para confirmar, escreva o telefone do membro. Os dados anteriores ficam guardados na auditoria.

O telefone de um membro não se altera: cada número pertence a um só cadastro. Se alguém mudou de número, elimine a ficha antiga e a pessoa cadastra-se com o número novo.

## 4. Dashboard

Mostra totais de membros, coristas, fazedores de cultura, homens, mulheres, baptizados e não baptizados, e as distribuições por coro, voz, área e categoria. Os números actualizam-se sozinhos a cada 15 segundos (ou carregue em *Actualizar agora*).

**Fazedor de cultura** é quem tem pelo menos uma categoria cultural além de "Corista".

## 5. Organograma

Mostra a estrutura Direcção da Instituição › Coordenação Cultural › Responsável do Coro e Adjunto › Secretaria, Direcção Musical, Tesouraria e Banda › Coristas › Coro A e Coro B, com o nome de quem ocupa cada cargo. Aparece **"Vago"** quando o cargo não tem ninguém.

## 6. Relatórios

Em **Relatórios**, cada relatório tem um botão **PDF** (para imprimir) e **Excel** (XLSX, para trabalhar os dados):

- Coro: lista geral de coristas, cada coro, por voz, por área, por faixa etária, por paróquia;
- Liderança: responsáveis, secretários, mestres, tesoureiros e banda;
- Fazedores de cultura: lista geral, por categoria, por área e estatísticas.

Os relatórios contêm dados pessoais: não os partilhe fora da liderança. Cada exportação fica registada na auditoria.

## 7. Listas parametrizáveis

Em **Configurações › Listas parametrizáveis** pode adicionar, renomear, ordenar e desactivar:
áreas, paróquias, tipos de voz, categorias culturais, coros, cargos e o nome dos perfis.

- Um item **em uso** não pode ser eliminado: **desactive-o** (deixa de aparecer nos formulários, mas os membros mantêm-no).
- A categoria "Corista" é usada automaticamente e não pode ser eliminada.
- Nos cargos, o campo *Sector (liderança)* define em que grupo aparecem no relatório de liderança.

## 8. Auditoria

Em **Auditoria** vê quem fez o quê e quando: criações, edições (com valores **antes e depois**), eliminações, entradas, saídas, exportações, bloqueios, alterações de configuração e pedidos de código. Filtre por utilizador, operação e datas.

## 9. Boas práticas

- Tenha **pelo menos dois administradores** (o sistema não deixa um administrador retirar o próprio perfil).
- Confirme semanalmente que as **cópias de segurança** estão a ser feitas e copiadas para fora do servidor.
- Não partilhe códigos OTP. A administração **nunca** pede o código a ninguém.
- Se um telemóvel de um membro for perdido ou roubado, **bloqueie** a conta até ele recuperar o número.
