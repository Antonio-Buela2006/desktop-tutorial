# Integração de Email — Alertas WILLY

O envio de alertas críticos usará a API HTTPS da Resend. A documentação oficial define o endpoint `POST https://api.resend.com/emails`, autenticado com `Authorization: Bearer <API_KEY>`, e exige os campos `from`, `to` e `subject`; o conteúdo pode ser enviado em `html` e/ou `text`. A API também suporta o cabeçalho `Idempotency-Key`, que será derivado do identificador estável da recomendação WILLY para evitar notificações duplicadas durante tentativas automáticas. [1]

O destinatário inicial será o email institucional configurado para a empresa, tratado como a caixa de correio do gestor responsável. A integração só deve ser ativada quando as variáveis `RESEND_API_KEY` e `RESEND_FROM_EMAIL` forem fornecidas, sendo obrigatório que o remetente pertença a um domínio verificado pelo fornecedor. [2]

## Referências

[1] [Resend — Send Email API](https://resend.com/docs/api-reference/emails/send-email)

[2] [Resend — Introduction](https://resend.com/docs/introduction)
