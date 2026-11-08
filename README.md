# Portefólio de aplicações web

Repositório de desenvolvimento de **Antonio-Buela2006**, com aplicações web construídas para explorar produto digital, gestão empresarial e experiências editoriais. O projeto principal é o **NEXORA**, uma plataforma de gestão empresarial; o repositório inclui também duas experiências editoriais independentes.

> Este repositório reúne trabalho em evolução. As funcionalidades assinaladas como concluídas representam o estado atual do código; as restantes fazem parte do roteiro de desenvolvimento.

## Projetos

| Diretório           | Projeto              | Descrição                                                                                                                   | Estado              |
| ------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `/`                 | **NEXORA**           | Plataforma de gestão empresarial com operações comerciais, contabilidade, recursos humanos, logística e o assistente WILLY. | Em desenvolvimento  |
| `/kultura-dispatch` | **KULTURA Dispatch** | Publicação editorial sobre cultura, música, tecnologia e opinião, com pesquisa, categorias e páginas de artigo.             | Protótipo funcional |
| `/coral-tocoista`   | **Grupo Coral**      | Gestão do grupo coral e dos fazedores de cultura (Laravel 12, MySQL): cadastro por OTP via WhatsApp, coros, cargos, relatórios e auditoria. | Pronto para produção |
| `/blog-colunistas`  | **Entrelinhas**      | Blog de colunistas centrado em opinião, leitura e apresentação editorial.                                                   | Protótipo funcional |

## Destaques técnicos do NEXORA

A aplicação principal utiliza uma arquitetura full-stack TypeScript, com cliente React/Vite, servidor Express, API tRPC, persistência MySQL através de Drizzle ORM e testes unitários com Vitest. O núcleo funcional inclui:

- gestão multiempresa e separação de dados por organização;
- papéis empresariais e verificação de permissões no servidor;
- operações comerciais, clientes, catálogo, vendas, faturação e lançamentos contabilísticos;
- recursos humanos, presenças, férias e avaliações;
- armazéns, inventário, fornecedores e entregas rastreáveis;
- recomendações e assistente conversacional WILLY, com registo de feedback;
- auditoria de ações sensíveis e exportação de dados em CSV.

O roteiro completo, incluindo trabalho futuro e itens em validação, está em [`todo.md`](./todo.md).

## Tecnologias

| Área                    | Tecnologias                                     |
| ----------------------- | ----------------------------------------------- |
| Interface               | React, Vite, TypeScript, Tailwind CSS, Radix UI |
| Servidor                | Node.js, Express, tRPC, Zod                     |
| Dados                   | MySQL, Drizzle ORM, migrações Drizzle           |
| Qualidade               | TypeScript, Vitest, Prettier                    |
| Experiências editoriais | React, Vite, Tailwind CSS, Framer Motion        |

## Requisitos

- Node.js 22 ou superior;
- pnpm 10;
- uma base de dados MySQL para executar o NEXORA em modo completo;
- variáveis de ambiente configuradas localmente, quando aplicável.

## Instalação e desenvolvimento

### NEXORA

Na raiz do repositório:

```bash
pnpm install
pnpm dev
```

Para verificar o projeto:

```bash
pnpm run check
pnpm test
pnpm run build
```

A aplicação usa variáveis de ambiente para a autenticação, a base de dados e integrações de servidor. Comece por consultar [`.env.example`](./.env.example) e crie um ficheiro `.env` local. **Nunca coloque credenciais reais no Git.**

### KULTURA Dispatch

```bash
cd kultura-dispatch
pnpm install
pnpm dev
```

Verificação e build:

```bash
pnpm run check
pnpm run build
```

### Entrelinhas

```bash
cd blog-colunistas
pnpm install
pnpm dev
```

Verificação e build:

```bash
pnpm run check
pnpm run build
```

## Organização do repositório

```text
.
├── client/                 # Interface do NEXORA
├── server/                 # API, autenticação e serviços do NEXORA
├── shared/                 # Tipos e utilitários partilhados
├── drizzle/                # Esquema e migrações da base de dados
├── kultura-dispatch/       # Projeto editorial KULTURA Dispatch
├── blog-colunistas/        # Projeto editorial Entrelinhas
├── .github/                # Automação, templates e normas de colaboração
├── todo.md                 # Roteiro de produto e estado das funcionalidades
└── email_integration_notes.md # Notas técnicas da futura integração de email
```

## Qualidade e contribuição

As alterações devem ser pequenas, focadas e acompanhadas pela documentação necessária. Antes de abrir um pull request, execute `pnpm run check`, `pnpm test` e `pnpm run build` na área afetada. Consulte [`CONTRIBUTING.md`](./CONTRIBUTING.md) para o fluxo recomendado e [`SECURITY.md`](./SECURITY.md) para comunicar vulnerabilidades.

## Licença

Este projeto é distribuído sob a licença [MIT](./LICENSE), salvo indicação diferente num subdiretório.

## Contacto

Perfil GitHub: [Antonio-Buela2006](https://github.com/Antonio-Buela2006)
