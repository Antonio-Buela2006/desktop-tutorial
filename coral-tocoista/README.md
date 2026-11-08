# Sistema de Gestão do Grupo Coral e dos Fazedores de Cultura

Plataforma web responsiva (mobile-first) para a Igreja de Nosso Senhor Jesus Cristo no Mundo. Cada membro faz o próprio cadastro com **telefone + código OTP enviado por WhatsApp**. A administração gere os coros, os cargos, as áreas e os fazedores de cultura, com dashboard actualizado em tempo real, organograma, relatórios PDF/XLSX, pesquisa e auditoria completa.

- **Stack:** Laravel 12 (PHP 8.2+), MySQL 8, Blade + Tailwind CSS + Alpine.js, DomPDF, Laravel Excel, PHPUnit.
- **Plano, modelo de dados e suposições:** [`docs/PLANO.md`](docs/PLANO.md)
- **Manual do administrador:** [`docs/MANUAL_ADMINISTRADOR.md`](docs/MANUAL_ADMINISTRADOR.md)

> Porque Laravel 12 e não 11: o Laravel 11 já não recebe correcções de segurança e tem vulnerabilidades conhecidas sem correcção. O Laravel 12 mantém a mesma estrutura e API.

---

## 1. Instalação local

Requisitos: PHP 8.2+ (extensões `pdo_mysql`, `gd`, `zip`, `mbstring`, `intl`), Composer 2, Node 20+, MySQL 8.

```bash
git clone <repositório> && cd coral-tocoista
composer install
npm install && npm run build
cp .env.example .env
php artisan key:generate
```

Crie a base de dados:

```sql
CREATE DATABASE coral CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'coral'@'localhost' IDENTIFIED BY 'uma-password-forte';
GRANT ALL ON coral.* TO 'coral'@'localhost';
```

Preencha `DB_*` no `.env` e, para testar localmente, defina `APP_ENV=local`, `APP_DEBUG=true` e `OTP_DRIVER=log` (o código aparece no ecrã).

```bash
php artisan migrate --seed      # só dados de referência (perfis, listas, organograma)
php artisan serve               # http://127.0.0.1:8000/entrar
```

**O primeiro número a validar o código e concluir o cadastro fica Administrador Geral.**

### Dados fictícios de demonstração (opcional)

```bash
php artisan db:seed --class=DemoSeeder
```

Cria 60 membros fictícios com números `+244 900 00x xxx` (admin: `900 000 001`, responsável: `900 000 002`). Nunca corra isto numa base com dados reais.

### Testes

Os testes usam uma base MySQL separada, `coral_test` (ver `phpunit.xml`):

```bash
php artisan test
```

Resultado actual: **65 testes, 554 verificações, todos a passar** (OTP, cadastro, regras de negócio, permissões, dashboard, relatórios, auditoria, segurança).

---

## 2. Configuração do WhatsApp (passo a passo)

O código é enviado pela **WhatsApp Business Cloud API** com um template da categoria **Authentication**.

1. **Conta Meta Business:** em <https://business.facebook.com> crie (ou use) a conta da instituição e conclua a verificação da empresa.
2. **App:** em <https://developers.facebook.com/apps> → *Criar app* → tipo *Business* → adicione o produto **WhatsApp**.
3. **Número de envio:** em *WhatsApp › API Setup* adicione e verifique o número que vai enviar os códigos (um número que **não** esteja a ser usado na app WhatsApp normal). Anote o **Phone number ID**.
4. **Token permanente:** em *Business Settings › Users › System users* crie um utilizador de sistema, atribua-lhe a app e a conta WhatsApp e gere um token com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`. (O token temporário da página de testes expira em 24 h.)
5. **Template de autenticação:** em *WhatsApp Manager › Message templates › Create template*:
   - Categoria: **Authentication**
   - Nome: `codigo_acesso`
   - Idioma: **Portuguese (POR)**, código `pt_PT` (ou o que escolher; tem de coincidir com `WHATSAPP_TEMPLATE_LANGUAGE`)
   - Entrega do código: **Copy code** (botão "Copiar código")
   - Opcional: aviso de segurança e expiração ("expira em 5 minutos")
   - Submeta e aguarde a aprovação.
6. **Pagamento:** associe um método de pagamento à conta WhatsApp (as conversas de autenticação são cobradas pela Meta).
7. **`.env` do servidor:**

   ```dotenv
   OTP_DRIVER=whatsapp
   WHATSAPP_TOKEN=EAAG...            # token permanente (nunca no Git)
   WHATSAPP_PHONE_NUMBER_ID=1234567890
   WHATSAPP_TEMPLATE=codigo_acesso
   WHATSAPP_TEMPLATE_LANGUAGE=pt_PT
   WHATSAPP_API_VERSION=v21.0
   ```

8. `php artisan config:cache` e teste a entrada com o seu número.

Se o envio falhar, o utilizador vê "Não foi possível enviar o código agora" e o erro (sem o código) fica em `storage/logs/laravel.log`.

**Modo de teste (`OTP_DRIVER=log`):** o código é escrito no log e só aparece no ecrã se `APP_DEBUG=true`. Em produção use sempre `APP_DEBUG=false`.

---

## 3. Deploy numa hospedagem

Funciona em VPS (recomendado) ou alojamento partilhado com PHP 8.2+, MySQL 8, SSH e Composer.

1. Envie o código (git ou SFTP) **sem** `vendor/`, `node_modules/` nem `.env`.
2. No servidor:

   ```bash
   composer install --no-dev --optimize-autoloader
   npm ci && npm run build        # ou compile localmente e envie a pasta public/build
   cp .env.example .env && php artisan key:generate
   ```

3. `.env` de produção: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://o-seu-dominio`, `SESSION_SECURE_COOKIE=true`, credenciais MySQL e WhatsApp. Se estiver atrás de um proxy/CDN que termina o HTTPS, defina `TRUSTED_PROXIES` (IP do proxy ou `*`).
4. A raiz pública do domínio (*document root*) deve apontar para a pasta **`public/`**. Em alojamento partilhado sem essa opção, coloque o projecto fora de `public_html` e aponte `public_html` para `public/` (ligação simbólica).
5. Permissões de escrita: `storage/` e `bootstrap/cache/` (dono = utilizador do servidor web).
6. Base de dados e optimização:

   ```bash
   php artisan migrate --force --seed
   php artisan config:cache && php artisan route:cache && php artisan view:cache
   ```

7. **HTTPS obrigatório** (Let's Encrypt / certificado do alojamento). Em produção a aplicação força URLs `https` e envia HSTS.
8. Partilhe o link `https://o-seu-dominio/entrar` e faça o primeiro cadastro (fica Administrador Geral).

Actualizações: `git pull && composer install --no-dev -o && npm run build && php artisan migrate --force && php artisan optimize`.

---

## 4. Cópias de segurança

O script [`scripts/backup.sh`](scripts/backup.sh) faz:

- `mysqldump --single-transaction` comprimido (`db-AAAAMMDD-HHMMSS.sql.gz`);
- arquivo das fotografias (`fotos-AAAAMMDD-HHMMSS.tar.gz`);
- verificação do ficheiro e rotação (apaga cópias com mais de 30 dias).

Configuração:

1. Credenciais **fora do código**, em `~/.my.cnf` com `chmod 600`:

   ```ini
   [mysqldump]
   user=coral
   password=uma-password-forte
   ```

2. Agende no cron (todos os dias às 02:30):

   ```cron
   30 2 * * * /var/www/coral-tocoista/scripts/backup.sh >> /var/backups/coral/backup.log 2>&1
   ```

   Variáveis opcionais: `BACKUP_DIR` (destino, por omissão `~/backups/coral`) e `KEEP_DAYS`.

3. **Copie as cópias para fora do servidor** (pelo menos semanalmente): disco externo, outro servidor (`rsync`) ou armazenamento na nuvem. Uma cópia no mesmo servidor não protege contra a perda do servidor.
4. **Teste o restauro** uma vez por mês numa base de testes:

   ```bash
   gunzip < db-20260101-023000.sql.gz | mysql coral_restauro
   tar -xzf fotos-20260101-023000.tar.gz -C storage/app
   ```

---

## 5. Segurança (resumo)

- OTP de 6 dígitos guardado só como **hash bcrypt**; 3 tentativas; validade configurável; 1 pedido/minuto por número; limite por IP (`OTP_IP_REQUESTS_PER_HOUR`); utilizadores bloqueados não recebem código e perdem a sessão.
- Permissões por **Policies** e *gates* (`admin`, `staff`), testadas para cada perfil.
- Eloquent / consultas parametrizadas (SQL injection), escape automático do Blade (XSS), CSRF em todos os formulários, sessões encriptadas.
- Cabeçalhos: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS sob HTTPS, `Cache-Control: no-store` nas páginas autenticadas.
- Uploads: só imagens até 2 MB, re-codificadas e guardadas em disco privado.
- Consentimento obrigatório no primeiro cadastro, com data registada.
- Auditoria de criação, edição, eliminação, entradas, exportações, bloqueios e configurações (antes/depois, IP, data e hora).

## 6. Imagem de fundo

Para usar a fotografia institucional no ecrã de entrada, coloque-a em **`public/images/fundo.jpg`** (recomendado: 1600 px de largura, < 400 KB). Sem esse ficheiro aparece uma colina verde estilizada.
