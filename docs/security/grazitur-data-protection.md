# Proteção de dados pessoais — GraziTur

Atualizado em 2 de setembro de 2026. Este documento não contém valores pessoais nem segredos.

## Estado de produção

O projeto Supabase `form-app` (`xgrcwdtkalelegoysxbw`) e o site
`grazitur.vercel.app` operam com proteção obrigatória dos dados pessoais.

No corte de produção:

- 241 cadastros foram migrados e verificados por descriptografia autenticada;
- 433 registros de auditoria foram migrados e verificados;
- 6 listas de espera foram analisadas e tiveram duplicações pessoais removidas;
- nenhum CPF, RG, nome real, e-mail, telefone, nascimento, cidade, endereço ou
  idade permaneceu nas colunas legadas;
- um cofre privado recebeu 241 envelopes de usuários, 433 envelopes de logs e
  6 snapshots de listas de espera antes do contrato final;
- a rota e o token temporários de migração foram removidos depois da validação.

As contagens registram o instante do corte. Novas linhas usam o mesmo modelo
criptográfico obrigatório.

## Modelo criptográfico

Campos que a aplicação precisa recuperar não usam hash irreversível. Eles usam
AES-256-GCM no backend, porque o sistema ainda precisa mostrar os dados aos
usuários autorizados e gerar documentos. Cada envelope usa:

- nonce aleatório de 96 bits e tag de autenticação de 128 bits;
- AAD vinculando aplicação, entidade, contexto estável, finalidade e versão;
- chave armazenada como segredo da Vercel, fora do banco e do Git;
- versão explícita para permitir rotação futura;
- falha fechada se chave, envelope ou metadados estiverem ausentes ou alterados.

O CPF também recebe HMAC-SHA-256 com chave separada para busca exata e controle
de duplicidade. Apenas os quatro últimos dígitos ficam separados para máscara.
HMAC não permite recuperar o CPF e não substitui a cópia criptografada.

O perfil criptografado contém nome, e-mail, RG, órgão expedidor, nascimento,
celular, cidade, endereço e idade. Título e detalhe de logs são guardados em um
envelope próprio, com uma chave independente.

## Armazenamento após o corte

Em `public.turismo_users`, as colunas legadas contêm somente o marcador técnico
`Dado Protegido` no nome e `NULL` nos demais campos pessoais. CPF e perfil
ficam nos respectivos envelopes criptografados.

Em `public.turismo_system_logs`, o título legado contém `Registro protegido`, o
detalhe legado fica nulo e o conteúdo completo permanece recuperável no envelope.
A saída administrativa continua aplicando redação defensiva.

Em `public.turismo_excursions`, a lista de espera guarda apenas referências técnicas,
data e origem. Uma restrição recursiva impede chaves pessoais, inclusive dentro
de objetos aninhados.

Os snapshots de segurança ficam em:

- `private.turismo_user_encrypted_backups`;
- `private.turismo_log_encrypted_backups`;
- `private.turismo_waitlist_encrypted_backups`.

Esse schema tem RLS ativo e privilégios revogados para `public`, `anon`,
`authenticated` e `service_role`. O backup contém somente envelopes e
metadados criptográficos, nunca os valores em texto legível.

## Padrão de nomenclatura

Todas as tabelas do produto de turismo usam `snake_case` e o prefixo
`turismo_`, no mesmo padrão de isolamento das tabelas `atletica_`:

- `public.turismo_users`;
- `public.turismo_excursions`;
- `public.turismo_system_logs`;
- `public.turismo_excursion_users`;
- `public.turismo_user_kinships`;
- as três tabelas privadas de backup listadas acima.

Sequências, índices, constraints, chaves estrangeiras, trigger de formatação e
função privada também usam o prefixo `turismo_`. A migração foi feita por
`ALTER ... RENAME`, preservando os OIDs e todas as linhas, e verificou
contagens e RLS antes de confirmar a transação.

## Controles permanentes

As migrations do Supabase:

- completam o envelope criptográfico de logs;
- criam o cofre privado;
- exigem armazenamento protegido em usuários e logs;
- rejeitam dados pessoais duplicados na lista de espera;
- mantêm RLS e a Data API sem acesso às tabelas do GraziTur.

Os modos de produção são:

- `GRAZITUR_CPF_PROTECTION_MODE=required`;
- `GRAZITUR_PII_PROTECTION_MODE=required`;
- `GRAZITUR_LOG_PROTECTION_MODE=required`.

Não alterar esses modos para `dual` ou `disabled` em produção. As constraints
do banco também bloqueiam novas gravações legíveis.

## Validação e operação

A validação pós-migração confirmou:

- 241 de 241 envelopes de CPF e perfil autenticados;
- 433 de 433 envelopes de log autenticados;
- zero colunas pessoais legadas preenchidas;
- zero itens de lista de espera com chaves pessoais;
- contagens do cofre iguais às tabelas no instante do backup.

RLS permanece ativo nas cinco tabelas da aplicação e sem policies públicas.
O backend usa Prisma; a Data API não é usada pelo GraziTur.

Para rotação futura, primeiro adicionar uma nova versão de chave, recriptografar
e verificar todos os envelopes, atualizar a versão ativa e só depois retirar a
chave antiga. Nunca substituir ou apagar uma chave ainda referenciada.

## Riscos residuais e próximos controles

- criar uma role dedicada de banco com privilégio mínimo para o runtime Prisma;
- habilitar proteção contra senhas vazadas no Supabase Auth;
- substituir a verificação estática do passageiro por OTP ou autenticação;
- definir política formal de retenção, descarte, rotação e resposta a incidente;
- revisar outros consumidores antes de qualquer alteração nas chaves.

Referências: [Securing your API](https://supabase.com/docs/guides/api/securing-your-api),
[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Secure Data](https://supabase.com/docs/guides/database/secure-data) e
[Backups](https://supabase.com/docs/guides/platform/backups).
