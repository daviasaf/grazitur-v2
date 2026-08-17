# Proteção de dados pessoais — GraziTur

Atualizado em 16 de agosto de 2026. Este documento não contém valores pessoais nem segredos.

## Resumo

O Supabase `form-app` (`xgrcwdtkalelegoysxbw`) é tratado como produção porque contém dados reais e atende `grazitur.vercel.app`.

Já está ativo em produção:

- RLS nas cinco tabelas da aplicação;
- revogação de todos os privilégios da Data API para `anon`, `authenticated` e `service_role`;
- ausência intencional de policies públicas, resultando em negação total pela Data API;
- autenticação administrativa no backend;
- CPF fora de URLs, cookies e respostas comuns;
- recuperação de senha administrativa pelo Supabase Auth;
- expansão criptográfica do CPF e do perfil pessoal, sem alterar linhas legadas.

O backend continua funcionando pelo Prisma e a Data API não é consumida pela aplicação. O Security Advisor não apresenta mais erros de RLS; os avisos `rls_enabled_no_policy` são informativos e representam o contrato de negação total escolhido.

Ainda não está concluído:

- backfill criptográfico das linhas antigas;
- mudança dos modos `dual` para `required`;
- limpeza ou remoção dos valores pessoais legados em texto claro;
- limpeza destrutiva de logs/JSON legados;
- renomeação com o prefixo `grazitur_`.

Essas etapas exigem aprovação separada, reconciliação e restauração comprovada. Não declarar proteção em repouso concluída enquanto os campos legados permanecerem preenchidos.

## Classificação dos dados

A LGPD considera dado pessoal toda informação relacionada a pessoa identificada ou identificável. A ANPD cita expressamente nome, RG, CPF e endereço residencial como exemplos. A aplicação contém:

| Categoria | Campos/objetos encontrados | Tratamento |
|---|---|---|
| Identificação civil | nome, CPF, RG, órgão expedidor, nascimento e idade | Criptografia autenticada; CPF também recebe HMAC para busca exata e últimos quatro dígitos para máscara |
| Contato e localização | e-mail, celular, cidade e endereço | Criptografia autenticada no perfil pessoal |
| Relações | vínculos familiares e participação em excursões | IDs técnicos; acesso somente pelo backend |
| Contratual e financeiro | contratos, assinaturas, parcelas, pagamentos e despesas | Backend/admin; sem Data API; respostas do passageiro limitadas ao próprio grupo |
| Auditoria | ações administrativas e finalidade de exportação | Redação automática de CPF/e-mail; limpeza legada pendente |

Não foram encontrados campos correspondentes às categorias legais de dados pessoais sensíveis do art. 5º, II — como saúde, biometria, religião, raça/etnia, opinião política, vida sexual ou dados genéticos. Isso não reduz o dever de proteger os dados pessoais comuns. Há cadastros de menores: a auditoria agregada estimou 54 pessoas com menos de 18 anos, sem retornar suas identidades.

Referências oficiais: [FAQ da ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes) e [LGPD, art. 5º](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).

## Inventário técnico

| Objeto | Estado de acesso | Conteúdo relevante |
|---|---|---|
| `public."User"` | RLS ativo; sem grants/policies para Data API | perfil pessoal, CPF e vínculos |
| `public."Excursao"` | RLS ativo; sem grants/policies para Data API | passageiros, pagamentos, contratos, assinaturas e lista de espera em JSON |
| `public."SystemLog"` | RLS ativo; sem grants/policies para Data API | auditoria administrativa |
| `public."_UserExcursao"` | RLS ativo; sem grants/policies para Data API | relação passageiro–excursão |
| `public."_UserKinship"` | RLS ativo; sem grants/policies para Data API | relação familiar |

Contagem agregada atual: 237 usuários; 237 CPFs ainda presentes no campo legado; 0 perfis pessoais criptografados antes do backfill. Nenhum valor individual foi retornado durante a validação.

## Modelo criptográfico

O código usa criptografia no backend confiável, com chaves externas ao banco e ao Git:

- AES-256-GCM, nonce aleatório de 96 bits e tag de 128 bits;
- AAD com aplicação, entidade, UUID estável do registro, finalidade do envelope e versão da chave;
- envelope versionado para rotação;
- perfil pessoal criptografado como JSON autenticado contendo nome, e-mail, RG, órgão, nascimento, celular, cidade, endereço e idade;
- CPF em envelope separado, com HMAC-SHA-256 de chave independente para igualdade/duplicidade;
- modos `dual` para migração e `required` para o cutover;
- falha fechada no modo obrigatório quando a linha ou chave não está protegida.

Arquivos principais:

- `server/utils/cpf-security.ts` — CPF, HMAC, máscara e rotação;
- `server/utils/pii-security.ts` — perfil pessoal criptografado;
- `prisma/backfill-cpf.ts` e `prisma/backfill-pii.ts` — backfills idempotentes, em lotes e somente diagnóstico por padrão;
- `supabase/migrations/20260816175833_secure_grazitur_personal_data_expand.sql` — expand do CPF;
- `supabase/migrations/20260816175838_harden_grazitur_data_api.sql` — RLS, grants e funções;
- `supabase/migrations/20260816235908_secure_grazitur_pii_expand.sql` — expand do perfil pessoal;
- `docs/security/grazitur-personal-data-contract-proposal.sql` — contract destrutivo ainda não executável.

## Imutabilidade de cadastros

Cadastros concluídos não podem mais ser editados:

- botões de edição foram removidos das áreas administrativa e do passageiro;
- `PUT` e `PATCH /api/users/:id` respondem `403`;
- a exceção pública de middleware para atualização foi removida;
- a rota de detalhe que aceitava `reveal=cpf` foi removida;
- a criação pública devolve somente o ID técnico;
- o cadastro de familiar usa ID vinculado à sessão do titular, sem transportar o CPF do titular pelo cliente.

A exclusão administrativa continua disponível e é uma operação distinta, com confirmação e auditoria.

## Sequência de rollout

1. Manter RLS/grants fechados e validar o backend Prisma.
2. Configurar chave exclusiva do perfil pessoal na Vercel Production e modo `dual`.
3. Publicar o código dual-read/dual-write e validar cadastro, login, contratos, excursões e documentos.
4. Executar `pnpm db:backfill-cpf` e `pnpm db:backfill-pii` sem flags de aplicação.
5. Após aprovação explícita, executar os dois backfills em lotes e reconciliar contagens, nulos e decrypt autenticado.
6. Mudar os dois modos para `required` e observar erros.
7. Somente após nova aprovação e restore comprovado, limpar/remover plaintext e sanear JSON/logs legados.
8. Tratar a renomeação `grazitur_` como rollout independente.

Rollback antes da limpeza: retornar leitores a `dual` e manter ambos os formatos. Depois da remoção do plaintext, o rollback depende do backup restaurável e das versões antigas das chaves.

## Evidências atuais

- A expansão do perfil pessoal adicionou 3 colunas, 1 constraint e 1 índice; 237 linhas preservadas e 0 envelopes criados antes do backfill.
- `public."User"`: RLS ativo; `anon` sem `SELECT`; `authenticated` sem `UPDATE`.
- Vercel `grazitur`/Production: `GRAZITUR_PII_PROTECTION_MODE=dual` e chave AES exclusiva armazenada como segredo sensível; nenhum valor foi exibido ou versionado.
- Security Advisor: somente cinco informações `rls_enabled_no_policy`, intencionais, e um aviso de proteção contra senhas vazadas desabilitada no Auth.
- Endpoints públicos de ping e excursões abertas continuaram respondendo após o fechamento da Data API.
- Backup lógico anterior foi restaurado e reconciliado em PostgreSQL isolado antes das primeiras expansões.

Referências técnicas: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Secure Data](https://supabase.com/docs/guides/database/secure-data) e [Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security).

## Riscos residuais

- Plaintext histórico continua no banco até backfill, cutover e contract aprovados.
- A verificação do passageiro ainda usa dois fatores estáticos (CPF e nascimento); migrar para OTP/Auth.
- A proteção contra senhas vazadas do Supabase Auth está desabilitada.
- O runtime Prisma ainda usa uma credencial ampla; criar role dedicada de menor privilégio.
- Retenção, descarte, resposta a incidente, custódia/rotação das chaves e acesso de outros consumidores precisam de política formal.
- Reescrever o histórico Git do seed antigo e sanear logs/JSON exige coordenação e aprovação destrutiva.
