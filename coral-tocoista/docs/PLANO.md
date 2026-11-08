# Plano técnico, modelo de dados e suposições

## 1. Estrutura de pastas (o essencial)

```
coral-tocoista/
├── app/
│   ├── Exports/ReportExport.php           XLSX real (Laravel Excel)
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── AuthController.php         telefone → OTP → entrada/cadastro
│   │   │   ├── RegistrationController.php cadastro do número novo
│   │   │   ├── ProfileController.php      "Minha ficha"
│   │   │   ├── MemberController.php       lista, ficha, perfil/cargos, bloqueio, eliminação, foto
│   │   │   ├── DashboardController.php    dashboard + JSON de actualização
│   │   │   ├── OrgChartController.php     organograma
│   │   │   ├── ReportController.php       PDF/XLSX
│   │   │   ├── AuditController.php        consulta da auditoria
│   │   │   └── Admin/{Settings,Lookup}Controller.php
│   │   ├── Middleware/{SecurityHeaders,EnsureNotBlocked}.php
│   │   └── Requests/MemberRequest.php     validação + regras condicionais
│   ├── Models/                            User (membro), Role, Area, Parish, VoiceType, Choir,
│   │                                      CulturalGroup, CulturalCategory, Position, OrgUnit,
│   │                                      OtpCode, AuditLog, Setting
│   ├── Policies/UserPolicy.php            permissões sobre fichas
│   ├── Services/
│   │   ├── Otp/{OtpSender,OtpService,WhatsAppOtpSender,LogOtpSender}.php
│   │   ├── MemberService.php              regras de negócio da ficha
│   │   ├── StatsService.php               totais do dashboard (consultas directas)
│   │   └── ReportService.php              dados de todos os relatórios
│   └── Support/{Audit,Auditable,Phone,FormOptions}.php
├── database/{migrations,seeders,factories}
├── resources/views/                       Blade + Tailwind + Alpine (mobile-first)
├── scripts/backup.sh                      cópia de segurança (mysqldump + fotos)
├── tests/Feature/                         65 testes PHPUnit
└── docs/                                  este plano + manual do administrador
```

## 2. Modelo de dados

| Tabela | Conteúdo | Índices |
|---|---|---|
| `roles` | Perfis: `admin`, `responsavel`, `membro` (slug fixo, nome editável) | slug único |
| `cultural_groups` | Grupos culturais (hoje: "Grupo Coral") — preparação para vários grupos | |
| `choirs` | Coros (Coro A, Coro B, …) ligados a um grupo | (grupo, nome) único |
| `areas`, `parishes`, `voice_types` | Listas parametrizáveis (`name`, `sort`, `active`) | nome único |
| `cultural_categories` | Categorias culturais; `is_choir_member` marca "Corista" | nome único |
| `org_units` | Unidades do organograma (árvore `parent_id`; `shows_choirs`) | |
| `positions` | Cargos, ligados a uma unidade; `leadership_group` para o relatório de liderança | nome único |
| `users` | Membro = utilizador. Dados pessoais, religiosos, corais, `consent_at`, `blocked_at` | **telefone único**, nome, sexo, baptizado, corista, FKs de área/coro/voz/paróquia |
| `position_user`, `cultural_category_user` | Vários cargos / várias categorias por membro | pares únicos |
| `otp_codes` | `code_hash` (bcrypt), `attempts`, `expires_at`, `consumed_at`, `invalidated_at`, IP | telefone |
| `audit_logs` | quem, quando, operação, entidade, valores antes/depois (JSON), IP, user-agent | operação, data, (tipo, id) |
| `settings` | Configurações (validade do OTP, nomes da instituição/grupo) | chave única |
| `sessions`, `cache`, `jobs` | Infra-estrutura Laravel | |

## 3. Fases (todas concluídas e testadas)

1. **Base de dados e seeders** — migrations, `ReferenceDataSeeder` (produção), `DemoSeeder` (fictício, separado).
2. **Autenticação OTP** — `OtpService`, drivers `whatsapp` e `log`, limites por número e por IP. → `OtpAuthTest`
3. **Cadastro** — formulário em 4 passos, regras condicionais no browser e no servidor, consentimento, fotografia. → `RegistrationTest`
4. **Administração** — lista com pesquisa/filtros, edição, perfil/cargos, bloqueio, eliminação com confirmação, listas parametrizáveis. → `AdminTest`, `PermissionsTest`
5. **Dashboard e organograma** — totais por consulta directa + actualização automática (15 s). → `DashboardReportsTest`, `AdminTest`
6. **Relatórios** — 11 relatórios (um por coro) em PDF e XLSX. → `DashboardReportsTest`
7. **Auditoria e segurança** — trait `Auditable`, ecrã com filtros, cabeçalhos, CSP, rate limiting. → `AuditTest`, `SecurityTest`
8. **Testes e documentação** — 65 testes, README, manual, rotina de backup.

## 4. Suposições registadas (onde o pedido era ambíguo)

1. **Laravel 12 em vez de 11.** O Laravel 11 deixou de receber correcções e o `composer audit` mostrava 5 vulnerabilidades sem correcção (incl. injecção CRLF na regra `email`, usada no formulário). O Laravel 12 tem a mesma estrutura e API.
2. **Membro = utilizador**: uma única tabela `users`; cada ficha é também a conta de acesso.
3. **"Fazedor de cultura"** = membro com pelo menos uma categoria cultural *além* de "Corista". "Artistas" por área usa a mesma definição.
4. **Cargo "Corista"** é atribuído/retirado automaticamente com a opção "é corista" (tal como a categoria "Corista"), para o organograma, filtros e relatórios baterem certo.
5. **Responsável do Coro** pode editar fichas de membros com perfil Corista/Membro (não de administradores nem de outros responsáveis) e nunca altera perfis, cargos ou bloqueios.
6. **O administrador não pode mudar o próprio perfil, bloquear-se nem eliminar-se** (evita ficar o sistema sem administrador).
7. **"Direcção da Instituição" e "Coordenação Cultural"** são unidades do organograma sem cargos associados na lista pedida; aparecem como caixas. O administrador pode associar-lhes cargos no futuro (tabela `positions.org_unit_id`).
8. **Link partilhado** = endereço público `/entrar` (mostrado e copiável em Configurações). Não há convites individuais.
9. **Validade da sessão após validar o número novo**: 30 minutos para concluir o cadastro.
10. **Sexo, data de nascimento, etc.** são opcionais (os únicos obrigatórios pedidos foram nome, telefone e área). Membros sem sexo não entram em "homens/mulheres".
11. **Datas**: os campos usam o selector de data do telemóvel (mostra dd/mm/aaaa em português); o servidor aceita também texto dd/mm/aaaa. Tudo é apresentado em dd/mm/aaaa.
12. **Eliminação** é definitiva (com confirmação escrevendo o telefone); a auditoria guarda todos os valores anteriores.
13. **Fotografias** ficam em disco privado (`storage/app/private/photos`), redimensionadas a 600 px e re-codificadas em JPEG (remove EXIF/GPS), e só são servidas a quem pode ver a ficha.
14. **Identidade visual tocoísta**: branco dominante (as vestes brancas), a **Estrela da Alva de 8 pontas** como símbolo (equilíbrio, concórdia e paz) junto ao logótipo das duas pedras, e o vermelho/ferrugem como acento (a estrela branca sobre fundo vermelho da história do movimento). Nomes e fórmulas da instituição são editáveis em Configurações; confirmar com a liderança local antes da publicação.
