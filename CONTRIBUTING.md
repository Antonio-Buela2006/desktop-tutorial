# Guia de contribuição

Obrigado pelo interesse em contribuir. Este repositório contém várias aplicações e a qualidade das alterações depende de mudanças pequenas, verificáveis e bem documentadas.

## Antes de começar

Leia o [`README.md`](./README.md) e confirme que está a trabalhar no diretório correto. O NEXORA é executado a partir da raiz; o KULTURA Dispatch e o Entrelinhas têm os seus próprios diretórios e manifestos `package.json`.

Crie um branch descritivo a partir de `main`:

```bash
git switch main
git pull --ff-only
git switch -c feat/nome-da-alteracao
```

Use prefixos consistentes, como `feat/` para funcionalidades, `fix/` para correções, `docs/` para documentação e `chore/` para manutenção.

## Desenvolvimento local

Instale as dependências com a versão de pnpm indicada pelo projeto:

```bash
pnpm install
```

Quando a alteração envolver o NEXORA, configure primeiro o `.env` com base em [`.env.example`](./.env.example). Não partilhe tokens, palavras-passe, URLs privadas ou dados de clientes em commits, issues ou pull requests.

## Validação obrigatória

Antes de abrir um pull request, execute os comandos adequados à área alterada:

```bash
pnpm run check
pnpm test
pnpm run build
```

Para os projetos editoriais, execute os mesmos comandos dentro do respetivo diretório. Se algum comando não puder ser executado por depender de serviços externos, registe a limitação e os passos usados para validar a alteração.

## Commits

Escreva mensagens no imperativo, curtas e específicas. Sempre que possível, siga o formato:

```text
<tipo>: <descrição objetiva>
```

Exemplos: `feat: adicionar filtro por estado de pagamento`, `fix: corrigir isolamento de dados por empresa` e `docs: atualizar instruções de instalação`.

Cada commit deve representar uma alteração coerente. Evite misturar refatorações extensas, alterações visuais não relacionadas e correções funcionais no mesmo commit.

## Pull requests

O título deve explicar o resultado da alteração. A descrição deve indicar o problema resolvido, a solução adotada, a área afetada, os testes executados e eventuais limitações conhecidas. Inclua capturas de ecrã quando a alteração for visual e indique se houve migrações de base de dados ou mudanças de configuração.

Não faça push direto para `main` para alterações que precisem de revisão. Um pull request deve ser revisto com base no impacto funcional, segurança, acessibilidade, compatibilidade e manutenção futura.

## Issues

Use o template de bug para problemas reproduzíveis e o template de funcionalidade para propostas novas. Antes de abrir uma issue, pesquise as issues existentes e inclua contexto suficiente para outra pessoa conseguir compreender o caso sem informação adicional.

## Segurança

Não publique vulnerabilidades em issues públicas. Siga o procedimento descrito em [`SECURITY.md`](./SECURITY.md).
