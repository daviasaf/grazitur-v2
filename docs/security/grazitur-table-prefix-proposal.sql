-- NOT A MIGRATION YET.
-- Candidate prefix confirmed from the repository name and product branding:
-- grazitur_. The owner must explicitly approve this prefix and the coordinated
-- Prisma relation-model cutover before this SQL becomes an executable migration.

begin;

alter table public."User" rename to grazitur_users;
alter table public."Excursao" rename to grazitur_excursions;
alter table public."SystemLog" rename to grazitur_system_logs;
alter table public."_UserKinship" rename to grazitur_user_kinships;
alter table public."_UserExcursao" rename to grazitur_excursion_users;

alter sequence public."User_id_seq" rename to grazitur_users_id_seq;
alter sequence public."Excursao_id_seq" rename to grazitur_excursions_id_seq;

alter trigger trg_formatar_nome_user on public.grazitur_users
  rename to grazitur_users_format_name_trigger;

-- Foreign-key targets follow PostgreSQL table renames automatically. Constraint,
-- index, policy, publication and generated-client names must still be reviewed
-- and renamed in the final migration. The two Prisma implicit many-to-many
-- relations must first become explicit models mapped to the prefixed join tables.

commit;
