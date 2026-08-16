# GraziTur Dashboard

Painel Nuxt + Prisma para controle de excursões, passageiros, contratos, Pix, relatórios e seed do banco.

## Como rodar

> Nesta versão, os logs ficam salvos em uma tabela própria (`SystemLog`). Depois de baixar esta atualização, rode `npx prisma generate` e `npx prisma db push` antes de iniciar o sistema.


```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Acesse:

- Site/passageiro: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

Credenciais padrão no `.env.example`:

```env
SUPABASE_URL="https://SEU-PROJECT-REF.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_SUBSTITUA"
```

## Configurando Supabase no `.env`

No Supabase, copie a string de conexão do banco PostgreSQL e preencha:

```env
DATABASE_URL="postgresql://postgres.SEU-PROJECT-REF:SUA-SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&schema=public"
DIRECT_URL="postgresql://postgres.SEU-PROJECT-REF:SUA-SENHA@db.SEU-PROJECT-REF.supabase.co:5432/postgres?schema=public"
```

Troque `SEU-PROJECT-REF` e `SUA-SENHA` pelos dados reais do seu projeto.

## Segurança e dados pessoais

O painel usa Supabase Auth para administradores e cookies `HttpOnly`. Conceda o papel administrativo em `app_metadata.role = "admin"`; nunca use `user_metadata` para autorização. O fallback `ADMIN_EMAIL`/`ADMIN_PASSWORD` existe apenas para desenvolvimento local e só funciona com `GRAZITUR_ALLOW_LEGACY_ADMIN_AUTH=true` fora de produção.

O CPF usa criptografia autenticada AES-256-GCM no backend e HMAC-SHA-256 separado para busca exata. Configure chaves diferentes por ambiente e por finalidade. Gere cada valor em Base64, por exemplo:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Nunca coloque as chaves no Git, no banco da aplicação ou em variáveis públicas. Consulte [o plano de proteção](docs/security/grazitur-data-protection.md) antes de executar migrations ou backfill.

Se aparecer erro `P1001 Can't reach database server`, geralmente é uma destas coisas:

1. senha do banco errada;
2. projeto Supabase pausado/inativo;
3. URL pooler ou direct URL copiada incompleta;
4. rede bloqueando a porta do banco;
5. `DATABASE_URL` sem `?pgbouncer=true&connection_limit=1` usando a porta `6543`.

## Seed do banco

Exports com dados pessoais ficam desabilitados por padrão e exigem autorização administrativa. Seeds reais nunca devem entrar no Git; use um arquivo fora do repositório e informe-o explicitamente por `SEED_FILE`.

Para importar um arquivo de seed:

```bash
SEED_FILE="./prisma/seed-users.json" npm run seed
```

No Windows PowerShell:

```powershell
$env:SEED_FILE="./prisma/seed-users.json"; npm run seed
```

Para limpar excursões antes de importar novamente:

```bash
SEED_RESET=true SEED_FILE="./prisma/seed-users.json" npm run seed
```

No Windows PowerShell:

```powershell
$env:SEED_RESET="true"; $env:SEED_FILE="./prisma/seed-users.json"; npm run seed
```

## Build

```bash
npm run build
npm run preview
```

## Mantendo ativo no Render

No plano gratuito do Render, um Web Service pode dormir depois de alguns minutos sem acessos. O projeto ja tem um endpoint leve para monitoramento:

```text
https://SEU-SITE.onrender.com/api/ping
```

Para reduzir o "sleep", crie um monitor externo em um servico como `cron-job.org`, UptimeRobot ou Better Stack:

1. configure uma requisicao `GET`;
2. use a URL `/api/ping` do seu deploy;
3. rode a cada 10 ou 14 minutos;
4. considere resposta HTTP `200` como sucesso.

Para producao com disponibilidade real, use uma instancia paga no Render, porque instancias pagas nao dormem por inatividade.

Tambem existe um ping automatico no servidor, parecido com:

```js
setInterval(() => {
  fetch("https://SEU-SITE.onrender.com/api/ping")
}, 300000)
```

Para ativar, configure esta variavel de ambiente no Render:

```env
KEEP_ALIVE_URL="https://SEU-SITE.onrender.com/api/ping"
```
