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
ADMIN_EMAIL="admin@grazitur.com"
ADMIN_PASSWORD="123456"
```

## Configurando Supabase no `.env`

No Supabase, copie a string de conexão do banco PostgreSQL e preencha:

```env
DATABASE_URL="postgresql://postgres.SEU-PROJECT-REF:SUA-SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&schema=public"
DIRECT_URL="postgresql://postgres.SEU-PROJECT-REF:SUA-SENHA@db.SEU-PROJECT-REF.supabase.co:5432/postgres?schema=public"
```

Troque `SEU-PROJECT-REF` e `SUA-SENHA` pelos dados reais do seu projeto.

Se aparecer erro `P1001 Can't reach database server`, geralmente é uma destas coisas:

1. senha do banco errada;
2. projeto Supabase pausado/inativo;
3. URL pooler ou direct URL copiada incompleta;
4. rede bloqueando a porta do banco;
5. `DATABASE_URL` sem `?pgbouncer=true&connection_limit=1` usando a porta `6543`.

## Seed do banco

O painel tem um botão em **Configuração > Baixar seed JSON**. O arquivo exportado inclui usuários, familiares, excursões, pagamentos, grupos, despesas, lista de espera, assinaturas e logs do sistema.

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
