# Guia de suporte (equipa Nexora)

1. Portal em **/admin** com conta própria (ative o 2FA). Papéis: owner, billing, support, readonly.
2. **Não há acesso livre a dados de clientes.** Visão geral mostra só metadados e métricas agregadas.
3. Para investigar um problema com dados, peça ao administrador da empresa que autorize um acesso em
   *Definições → Acesso de suporte* (e-mail do técnico, motivo, âmbito, até 72h).
4. Em *Suporte*, consulte apenas os conjuntos autorizados enquanto a concessão estiver ativa.
   Cada consulta fica na auditoria **da empresa** (visível para o cliente). Salários nunca são mostrados.
5. Pagamentos por transferência: *Pagamentos → Reconciliar* após confirmar no extrato (indique a nota).
6. Alterações comerciais (planos, preços, módulos, parâmetros) ficam no histórico de auditoria com antes/depois.
7. Incidentes: registar cronologia, impacto e ações; usar os logs (cada resposta tem `x-request-id`).
8. **Incidentes**: em *Incidentes*, abra o incidente (gravidade, empresas afetadas ou todas) e publique atualizações até à resolução. As empresas afetadas recebem notificação e veem um aviso no painel.
9. **Retenção**: em *Retenção*, as empresas com subscrição terminada mostram o prazo. Depois de cumprido, um *owner* executa a retenção, escrevendo o nome da empresa e o motivo. Nunca é possível sob retenção legal.
