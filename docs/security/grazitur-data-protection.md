# Proteção de dados pessoais e prefixo de tabelas — GraziTur

Data do diagnóstico: 16 de agosto de 2026. Este documento não contém valores pessoais nem segredos.

## 1. Resumo executivo

O risco atual é **crítico**. O projeto Supabase confirmado é `form-app` (`xgrcwdtkalelegoysxbw`) e foi classificado conservadoramente como **produção**, pois contém dados reais e atende a aplicação hospedada no Render. As cinco tabelas do GraziTur estão no schema exposto `public`, têm RLS desabilitado e concedem privilégios amplos — inclusive leitura, escrita e `TRUNCATE` — a `anon`, `authenticated` e `service_role`. O Security Advisor confirmou os cinco erros de RLS.

Há 237 cadastros com CPF em texto claro. Todos têm 11 dígitos, checksum válido e não há duplicidades normalizadas. Há 280 logs com CPF ou outro rótulo sensível. A autenticação administrativa anterior existia apenas no cliente e não protegia as APIs; a consulta do passageiro enviava CPF na URL e o mantinha no navegador.

Recomendação: usar criptografia autenticada no backend e HMAC separado para o CPF, fechar a Data API para tabelas acessadas somente pelo Prisma, ativar autenticação server-side, executar expand/backfill/cutover e remover o plaintext somente após restauração comprovada. `grazitur_` foi confirmado como o prefixo definitivo, mas a renomeação permanece bloqueada até aprovação específica.

## 2. Inventário de dados e mapa de exposição

| Local | Conteúdo / quantidade | Exposição observada | Risco / ação |
|---|---|---|---|
| `public."User"` | 237 linhas; CPF, nome, e-mail, RG, órgão, nascimento, celular, cidade, endereço e idade | Texto claro; RLS off; grants completos da Data API | Crítico. Expand criptográfico, backfill e fechamento da Data API |
| CPF em `User` | 237 presentes; 237 checksums válidos; 0 duplicidades | Coluna única em texto claro e respostas comuns | AES-256-GCM + HMAC-SHA-256 + máscara |
| E-mail, celular, nascimento e endereço | 237 presentes em cada campo | Texto claro e objetos completos enviados ao cliente | Minimizar projeções; finalidade/retenção e criptografia **[A definir]** |
| RG | 72 presentes | Texto claro; usado em contrato | Criptografar ou separar em cofre de perfil após definir recuperação |
| `Excursao.listaEsperaJson` | Uma excursão contém CPF no JSON legado | CPF e celular duplicados fora do cadastro canônico | Migrar para referência por `userId`; migration preparada |
| `Excursao.pagamentosJson` | Dados financeiros identificados por ID; uma excursão correspondeu à busca de chaves financeiras | API administrativa carregava o objeto completo | Manter server-side e retornar apenas grupo autorizado |
| `Excursao.assinaturasJson` | Código escrevia CPF e celular do guia | Duplicação desnecessária, embora a amostra atual não tenha correspondência | Escrita removida; migration remove chaves legadas |
| `SystemLog` | 384 linhas; 280 com 11 dígitos/rótulos sensíveis | Leitura pela API e plaintext no banco | Redação defensiva no código e migration de saneamento |
| Seed versionado | `prisma/seed-users.json`, introduzido no commit `eaf137a` | Dados pessoais no Git e no histórico | Removido do índice, preservado localmente e ignorado; reescrita do histórico requer aprovação |
| Export de seed | Usuários, excursões, logs e CPF completo | Download pelo navegador | Desabilitado por padrão; sessão admin, finalidade, `no-store` e auditoria |
| Supabase Auth | 0 usuários; nenhum metadata key | Não era usado pelo app | Admin local migrado para Auth; provisionamento ainda necessário |
| Supabase Storage | 0 buckets, 0 objetos | Sem exposição encontrada | Nenhuma ação atual |
| Views / materialized views | Nenhuma | — | Nenhuma ação atual |
| Funções/triggers | `formatar_nome`, `trigger_formatar_nome_user`; trigger em INSERT/UPDATE | `search_path` mutável | Migration qualifica função e fixa `search_path` |
| Realtime/publications | Nenhuma tabela `public` publicada | Sem exposição encontrada | Revalidar após renomeação |

Foi criado e restaurado um dump lógico local do snapshot de 16/08/2026. Backups gerenciados/off-site, ferramentas de BI, analytics externos ou outros repositórios consumidores continuam **[A definir]**.

## 3. Matriz campo × finalidade × proteção

| Campo | Finalidade observada | Recuperar? | Buscar? | Proteção definida | Retenção |
|---|---|---:|---:|---|---|
| CPF | Cadastro, deduplicação, área do passageiro, contrato e export autorizado | Sim, excepcionalmente | Igualdade exata | AES-256-GCM aleatório + AAD; HMAC-SHA-256 separado; `last4` | **[A definir — LGPD/contratos]** |
| Nome | Operação da excursão e contrato | Sim | Sim | Controle de acesso e projeção mínima; criptografia de campo a avaliar | **[A definir]** |
| E-mail | Contato e futura identidade Auth | Sim | Possivelmente | Controle de acesso; criptografia de campo a avaliar | **[A definir]** |
| RG / órgão | Contrato e documentação | Sim | Não observado | Candidato forte a criptografia autenticada | **[A definir]** |
| Nascimento | Contrato e verificação transitória do passageiro | Sim | Igualdade na sessão transitória | Resposta mínima; migrar autenticação para Auth/OTP | **[A definir]** |
| Celular | WhatsApp operacional | Sim | Não observado | Resposta por finalidade; criptografia a avaliar | **[A definir]** |
| Cidade/endereço | Contrato | Sim | Não observado | Endereço candidato forte a criptografia | **[A definir]** |
| Pagamentos/despesas | Financeiro e relatórios | Sim | Por ID | Backend/admin; sem Data API | **[A definir — fiscal]** |
| Assinaturas | Evidência contratual | Sim | Por usuário/viagem | IDs e timestamps; sem CPF/celular duplicado | **[A definir — jurídico]** |
| Senha | Autenticação administrativa | Não deve existir no domínio | — | Supabase Auth; `app_metadata.role` para autorização | Política do Auth |

## 4. Modelo criptográfico

Foi implementada proteção **na aplicação/backend confiável**:

- CPF normalizado e validado antes da transformação.
- AES-256-GCM com IV aleatório de 96 bits e tag de 128 bits.
- AAD: aplicação, entidade, UUID de contexto do registro, campo e versão da chave.
- HMAC-SHA-256 determinístico, com chave independente, para igualdade e unicidade.
- Envelope e índice cegos versionados; leitores aceitam versões configuradas durante rotação.
- `cpf_last4` guarda somente os quatro últimos dígitos para máscara.
- Modos `dual` (expand/backfill) e `required` (cutover); produção falha fechada por padrão.
- Chaves nunca entram em migration, Git, cliente ou banco da aplicação.

Alternativas: `pgsodium` não foi adotado porque o Supabase o marca como pendente de depreciação e desaconselha Transparent Column Encryption. Vault é apropriado para segredos usados dentro do Postgres, mas não substitui por si só o desenho de criptografia de cada CPF. Referências: [pgsodium](https://supabase.com/docs/guides/database/extensions/pgsodium), [Vault](https://supabase.com/docs/guides/database/vault).

KMS/secret manager, custódia, rotação e recuperação permanecem **[A definir]**. As chaves de produção não foram geradas.

## 5. Ameaças e matriz de autorização

| Ator/canal | Acesso esperado | Controle local implementado | Lacuna |
|---|---|---|---|
| Visitante | Criar cadastro validado; listar viagens abertas sem PII | Projeção pública mínima; sem CPF em URL | Rate limit/bot protection **[A definir]** |
| Passageiro | Próprio perfil e grupo familiar da excursão | Cookie `HttpOnly`, `SameSite=Strict`, 30 min; CPF+nascimento só no POST | Verificação ainda é fator estático; migrar para Supabase Auth/OTP |
| Administrador | Gestão e documentos justificados | Supabase Auth; papel somente em `app_metadata`; cookie server-side | Criar usuário Auth/admin e política de reautenticação |
| `anon` / `authenticated` Data API | Nenhum acesso às tabelas internas | Migration revoga grants e ativa RLS sem políticas | Aplicação remota depende de aprovação |
| Backend Prisma | CRUD de objetos GraziTur | Somente servidor; URLs de banco não são públicas | Hoje usa `postgres`; criar role dedicada de menor privilégio |
| Outra aplicação no banco | Apenas seus objetos/contratos aprovados | Prefixo proposto e grants isolados | Ownership e matriz entre aplicações **[A definir]** |
| Operador com dump | Não obter CPF sem chave | Ciphertext + chave externa | Outros campos pessoais ainda em plaintext |

Documentação de base: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security). O changelog de 2026 também anuncia exposição opt-in de novas tabelas e enforcement em 30/10/2026: [breaking change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## 6. Mapa de renomeação

Prefixo candidato: `grazitur_`.

| Atual | Proposto |
|---|---|
| `public."User"` | `public.grazitur_users` |
| `public."Excursao"` | `public.grazitur_excursions` |
| `public."SystemLog"` | `public.grazitur_system_logs` |
| `public."_UserKinship"` | `public.grazitur_user_kinships` |
| `public."_UserExcursao"` | `public.grazitur_excursion_users` |

O SQL proposto está em `docs/security/grazitur-table-prefix-proposal.sql`. Embora o prefixo `grazitur_` esteja confirmado, a migration executável não foi criada porque a renomeação requer aprovação separada e as duas relações many-to-many implícitas do Prisma precisam virar modelos explícitos. Objetos `auth`, `storage`, `realtime`, `vault` e `extensions` não serão renomeados. O uso de `@@map`/`@map` permite manter a API do Prisma após o cutover: [Prisma database mapping](https://www.prisma.io/docs/orm/prisma-schema/data-model/database-mapping).

## 7. Expand/contract, backfill, cutover e rollback

1. Projeto, ambiente e prefixo confirmados; consumidores adicionais e política de retenção ainda precisam ser definidos.
2. Criar backup apropriado, registrar checksum e restaurar em ambiente isolado. Sem evidência de restore, parar.
3. Provisionar chaves distintas e segredos de sessão por ambiente; criar admin no Supabase Auth com `app_metadata.role=admin`.
4. Aplicar somente a migration expand; deploy em modo `dual`.
5. Executar `pnpm db:backfill-cpf` primeiro sem `CPF_BACKFILL_APPLY`; após aprovação, executar em lotes com a flag.
6. Reconciliar contagens, nulos, checksum, duplicidades, decrypt autenticado e buscas por todas as versões.
7. Aplicar hardening da Data API e testar backend, `anon` e `authenticated` negativa e positivamente.
8. Aplicar limpeza de logs/JSON somente após backup e aprovação; é destrutiva.
9. Deploy em modo `required`, monitorar e executar o contract proposto para remover plaintext.
10. Renomear tabelas em deploy coordenado separado, após converter relações Prisma e confirmar `grazitur_`.

Rollback: antes da limpeza, reverter o código para leitura legada e remover apenas colunas novas vazias. Depois de backfill, preservar ambos os formatos até estabilizar. Depois de redigir ou remover plaintext, rollback depende do backup restaurável e das chaves antigas. Rotação não termina até todos os registros serem recriptografados, reconciliados e a chave anterior ser descartada formalmente.

## 8. Código e migrations locais

- `server/utils/cpf-security.ts`: validação, AEAD, HMAC, máscara, rotação e redação.
- `server/utils/admin-auth.ts`, `server/middleware/api-auth.ts`: Supabase Auth e autorização de APIs.
- `server/utils/passenger-auth.ts`: sessão transitória sem CPF em URL/cookie.
- `prisma/backfill-cpf.ts`: backfill em lotes, idempotente e desligado por padrão.
- `prisma/seed.mjs`: importa CPF já protegido e elimina CPF/celular/e-mail duplicados de logs, lista de espera e assinaturas legadas.
- `supabase/migrations/20260816175833_secure_grazitur_personal_data_expand.sql`: colunas e constraints de expansão.
- `supabase/migrations/20260816175838_harden_grazitur_data_api.sql`: revogação, RLS e funções endurecidas.
- `supabase/migrations/20260816180741_redact_grazitur_legacy_pii.sql`: limpeza destrutiva separada.
- `docs/security/grazitur-personal-data-contract-proposal.sql`: remoção futura do legado.
- `docs/security/grazitur-table-prefix-proposal.sql`: renomeação bloqueada por confirmação.

Somente a migration expand foi aplicada ao projeto remoto. Backfill, hardening de RLS/grants, limpeza destrutiva, renomeação e contract permanecem sem execução.

## 9. Evidências

- Consulta agregada remota: 237 CPFs com checksum válido; 0 inválidos; 0 duplicidades; nenhum valor retornado.
- Contagens remotas e do restore reconciliadas: `User=237`, `Excursao=6`, `SystemLog=384`, `_UserExcursao=215` e `_UserKinship=141`.
- Dump lógico local protegido por ACL e EFS: `schema.sql` (10.545 bytes, SHA-256 `4FF2C1AA6C5D384E0489503945A81C93ACFBC6E8705814A17C5741A461EDC24D`) e `data.sql` (187.390 bytes, SHA-256 `BDEB3060B27060F5E561F02E4D682457490E6DCF9F30DDD3DF6067CA0BED1C9E`). Os arquivos estão em diretório ignorado pelo Git.
- Restore comprovado em PostgreSQL 17 isolado e descartável; o contêiner foi removido após a reconciliação.
- Migration expand aplicada sobre o restore: 237 linhas preservadas, cinco colunas novas, CPF nullable, duas constraints e dois índices; nenhum ciphertext criado antes do backfill.
- Pré-condição remota da expand: zero colunas/índices/constraints novos existentes e zero locks pendentes em `User` no momento da consulta.
- Migration remota `20260816191144 secure_grazitur_personal_data_expand` registrada com sucesso no `form-app`: 237 usuários preservados, 0 CPFs legados nulos, 0 ciphertexts criados, cinco colunas, dois índices e duas constraints confirmados.
- Security Advisor: cinco erros `rls_disabled_in_public`; dois warnings `function_search_path_mutable`.
- Auth/Storage: 0 usuários Auth, 0 buckets e 0 objetos.
- Views/materialized views/publications: nenhuma.
- Migrations remotas: nenhuma registrada.
- `pnpm exec prisma validate`: schema válido.
- `pnpm test`: 6/6 testes verdes — normalização, validação, máscara, HMAC, encrypt/decrypt, AAD incorreto, adulteração e redação.
- `pnpm typecheck`: sem erros.
- `pnpm build`: build Nuxt/Nitro de produção concluído com sucesso.
- `pnpm audit --prod`: nenhuma vulnerabilidade conhecida após atualizar o Nuxt para 4.5.2 e fixar versões transitivas corrigidas.
- Migration de RLS/grants, limpeza, renomeação, backfill e teste de RLS com papéis reais: **não executados**, pois estão fora da etapa autorizada. O Security Advisor pós-expand manteve os cinco erros de RLS e dois warnings de `search_path`, sem novo achado.

## 10. Riscos residuais e aprovações necessárias

1. A classificação de `form-app` como produção foi adotada conservadoramente; registrar formalmente essa classificação e os demais consumidores do banco.
2. `grazitur_` está confirmado como prefixo definitivo; aprovar separadamente a conversão das relações Prisma e a renomeação coordenada.
3. Manter uma cópia off-site/gerenciada e testar a recuperação fora deste perfil Windows; o dump lógico local com restore já foi evidenciado.
4. Definir KMS/secret manager, responsáveis, retenção e rotação.
5. Provisionar Supabase Auth administrativo e decidir autenticação forte de passageiros.
6. A expand DDL está concluída. Aprovar, separadamente, backfill, RLS/grants, limpeza legada, cutover e remoção de plaintext.
7. Definir finalidade/retenção e proteção de RG, endereço, nascimento, e-mail e celular.
8. Criar role Postgres dedicada para o GraziTur, com grants e política RLS exclusivos; deixar de usar `postgres` no runtime. Defaults globais do schema compartilhado não foram alterados.
9. Reescrever o histórico Git e coordenar force-push para eliminar o seed antigo; o arquivo local foi preservado.
10. Adicionar rate limit, reautenticação para revelação/export e testes com dois aplicativos/tenants quando o modelo de organizações existir.

Segurança não é declarada concluída: a implementação está preparada localmente, mas o banco remoto ainda permanece no estado crítico diagnosticado até as aprovações e o rollout controlado.
