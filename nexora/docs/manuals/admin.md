# Manual do administrador da empresa

## Primeiros passos
1. Registe a empresa em **/registo** (demonstração de 14 dias ou subscrição paga).
2. Ative o **2FA** em *Segurança* (obrigatório para administradores por omissão).
3. Em *Funcionários*, registe a equipa (pessoas sem conta também contam para o limite de funcionários).
4. Em *Utilizadores*, convide quem precisa de acesso e atribua **funções**.

## Funções e permissões
- Funções predefinidas: Administrador, Diretor-geral, Gestor de RH, Contabilista, Gestor financeiro,
  Gestor de stock, Comercial, Vendedor, Funcionário. Pode editá-las ou criar funções novas.
- **Acesso temporário**: ao atribuir uma função, defina "até" (ex.: substituição em férias).
- **Ajustes individuais**: conceder ou negar uma permissão concreta a um utilizador.
- **Segregação de funções**: quem regista uma despesa ≥ 500 000 não a pode aprovar; o mesmo para ações sensíveis da IA.
- Administradores secundários só concedem permissões que eles próprios têm e não gerem outros administradores.

## Saída de um funcionário
*Funcionários → Registar saída*: o acesso é revogado de imediato (sessões terminadas), a vaga de
utilizador é libertada e o histórico mantém-se.

## Subscrição
- Alterar plano (com pré-visualização do impacto), módulos (grátis nos primeiros 7 dias), comprar
  utilizadores adicionais e créditos de IA (sempre com autorização explícita).
- Atraso: dias 1–3 normal · 4–8 somente leitura · 9+ suspensão. Os dados nunca são apagados.
- Cancelar: mantém acesso até ao fim do período pago; exporte os dados em *Exportar dados*.

## IA
*Assistente IA → Políticas*: ativar/desativar, nível de acesso aos dados (restrito, personalizado,
geral), autonomia, dupla aprovação financeira, módulos, idiomas, alertas, delegação a administradores secundários.

## Segurança e conformidade
*Definições*: exigir 2FA, tempo de inatividade, máximo de dispositivos, prazo da lixeira,
transferência da administração principal, **acesso de suporte** temporário à equipa Nexora.
*Auditoria*: histórico completo com verificação de integridade da cadeia.

## Importação em massa
Em *Clientes* ou *Stock* → **Importar CSV**:
1. Descarregue o modelo ou use o seu ficheiro (vírgula ou ponto e vírgula, com cabeçalho).
2. Veja a pré-visualização: linhas válidas, com erros (com o motivo) e duplicadas (NIF ou SKU já existentes ou repetidos no ficheiro).
3. Confirme. Só as linhas válidas são gravadas, e a importação fica na auditoria.
