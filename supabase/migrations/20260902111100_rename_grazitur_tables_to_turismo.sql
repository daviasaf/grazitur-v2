begin;

lock table
  public."User",
  public."Excursao",
  public."SystemLog",
  public."_UserExcursao",
  public."_UserKinship",
  private.grazitur_user_encrypted_backup,
  private.grazitur_log_encrypted_backup,
  private.grazitur_waitlist_encrypted_backup
in access exclusive mode;

create temporary table turismo_rename_guard (
  target_name text primary key,
  relation_oid oid not null,
  row_count bigint not null,
  rls_enabled boolean not null
) on commit drop;

insert into turismo_rename_guard (target_name, relation_oid, row_count, rls_enabled)
select 'public.turismo_users', c.oid, (select count(*) from public."User"), c.relrowsecurity
from pg_class c where c.oid = 'public."User"'::regclass
union all
select 'public.turismo_excursions', c.oid, (select count(*) from public."Excursao"), c.relrowsecurity
from pg_class c where c.oid = 'public."Excursao"'::regclass
union all
select 'public.turismo_system_logs', c.oid, (select count(*) from public."SystemLog"), c.relrowsecurity
from pg_class c where c.oid = 'public."SystemLog"'::regclass
union all
select 'public.turismo_excursion_users', c.oid, (select count(*) from public."_UserExcursao"), c.relrowsecurity
from pg_class c where c.oid = 'public."_UserExcursao"'::regclass
union all
select 'public.turismo_user_kinships', c.oid, (select count(*) from public."_UserKinship"), c.relrowsecurity
from pg_class c where c.oid = 'public."_UserKinship"'::regclass
union all
select 'private.turismo_user_encrypted_backups', c.oid, (select count(*) from private.grazitur_user_encrypted_backup), c.relrowsecurity
from pg_class c where c.oid = 'private.grazitur_user_encrypted_backup'::regclass
union all
select 'private.turismo_log_encrypted_backups', c.oid, (select count(*) from private.grazitur_log_encrypted_backup), c.relrowsecurity
from pg_class c where c.oid = 'private.grazitur_log_encrypted_backup'::regclass
union all
select 'private.turismo_waitlist_encrypted_backups', c.oid, (select count(*) from private.grazitur_waitlist_encrypted_backup), c.relrowsecurity
from pg_class c where c.oid = 'private.grazitur_waitlist_encrypted_backup'::regclass;

drop view public.turismo_user_kinships;
drop view public.turismo_excursion_users;
drop view public.turismo_system_logs;
drop view public.turismo_excursions;
drop view public.turismo_users;

alter table public."User" rename to turismo_users;
alter table public."Excursao" rename to turismo_excursions;
alter table public."SystemLog" rename to turismo_system_logs;
alter table public."_UserExcursao" rename to turismo_excursion_users;
alter table public."_UserKinship" rename to turismo_user_kinships;

alter table private.grazitur_user_encrypted_backup rename to turismo_user_encrypted_backups;
alter table private.grazitur_log_encrypted_backup rename to turismo_log_encrypted_backups;
alter table private.grazitur_waitlist_encrypted_backup rename to turismo_waitlist_encrypted_backups;

alter table public.turismo_excursion_users rename column "A" to excursion_id;
alter table public.turismo_excursion_users rename column "B" to user_id;
alter table public.turismo_user_kinships rename column "A" to user_id;
alter table public.turismo_user_kinships rename column "B" to relative_user_id;

alter sequence public."User_id_seq" rename to turismo_users_id_seq;
alter sequence public."Excursao_id_seq" rename to turismo_excursions_id_seq;

alter function private.grazitur_jsonb_has_sensitive_keys(jsonb)
  rename to turismo_jsonb_has_sensitive_keys;
alter function public.trigger_formatar_nome_user()
  rename to turismo_format_user_name;
alter trigger trg_formatar_nome_user on public.turismo_users
  rename to turismo_users_format_name_trigger;

alter table public.turismo_users
  rename constraint "User_pkey" to turismo_users_pkey;
alter table public.turismo_users
  rename constraint "User_cpf_last4_check" to turismo_users_cpf_last4_check;
alter table public.turismo_users
  rename constraint "User_cpf_protection_consistency_check" to turismo_users_cpf_protection_consistency_check;
alter table public.turismo_users
  rename constraint "User_pii_envelope_consistency_check" to turismo_users_pii_envelope_consistency_check;
alter table public.turismo_users
  rename constraint "User_protected_storage_required" to turismo_users_protected_storage_required;

alter index public."User_cpf_key" rename to turismo_users_cpf_key;
alter index public."User_cpf_blind_index_key" rename to turismo_users_cpf_blind_index_key;
alter index public."User_cpf_context_id_key" rename to turismo_users_cpf_context_id_key;
alter index public."User_pii_context_id_key" rename to turismo_users_pii_context_id_key;

alter table public.turismo_excursions
  rename constraint "Excursao_pkey" to turismo_excursions_pkey;
alter table public.turismo_excursions
  rename constraint "Excursao_guiaId_fkey" to turismo_excursions_guia_id_fkey;
alter table public.turismo_excursions
  rename constraint "Excursao_waitlist_without_personal_data" to turismo_excursions_waitlist_without_personal_data;

alter table public.turismo_system_logs
  rename constraint "SystemLog_pkey" to turismo_system_logs_pkey;
alter table public.turismo_system_logs
  rename constraint "SystemLog_content_envelope_complete" to turismo_system_logs_content_envelope_complete;
alter table public.turismo_system_logs
  rename constraint "SystemLog_protected_storage_required" to turismo_system_logs_protected_storage_required;

alter index public."SystemLog_action_idx" rename to turismo_system_logs_action_idx;
alter index public."SystemLog_content_context_id_key" rename to turismo_system_logs_content_context_id_key;
alter index public."SystemLog_createdAt_idx" rename to turismo_system_logs_created_at_idx;
alter index public."SystemLog_entity_idx" rename to turismo_system_logs_entity_idx;

alter table public.turismo_excursion_users
  rename constraint "_UserExcursao_A_fkey" to turismo_excursion_users_excursion_id_fkey;
alter table public.turismo_excursion_users
  rename constraint "_UserExcursao_B_fkey" to turismo_excursion_users_user_id_fkey;
alter index public."_UserExcursao_AB_unique"
  rename to turismo_excursion_users_excursion_id_user_id_key;
alter index public."_UserExcursao_B_index"
  rename to turismo_excursion_users_user_id_idx;

alter table public.turismo_user_kinships
  rename constraint "_UserKinship_A_fkey" to turismo_user_kinships_user_id_fkey;
alter table public.turismo_user_kinships
  rename constraint "_UserKinship_B_fkey" to turismo_user_kinships_relative_user_id_fkey;
alter index public."_UserKinship_AB_unique"
  rename to turismo_user_kinships_user_id_relative_user_id_key;
alter index public."_UserKinship_B_index"
  rename to turismo_user_kinships_relative_user_id_idx;

alter table private.turismo_user_encrypted_backups
  rename constraint grazitur_user_encrypted_backup_pkey to turismo_user_encrypted_backups_pkey;
alter table private.turismo_log_encrypted_backups
  rename constraint grazitur_log_encrypted_backup_pkey to turismo_log_encrypted_backups_pkey;
alter table private.turismo_waitlist_encrypted_backups
  rename constraint grazitur_waitlist_encrypted_backup_pkey to turismo_waitlist_encrypted_backups_pkey;

do $$
declare
  guarded record;
  current_count bigint;
  current_rls boolean;
begin
  for guarded in select * from turismo_rename_guard
  loop
    if to_regclass(guarded.target_name) is null
      or to_regclass(guarded.target_name)::oid <> guarded.relation_oid then
      raise exception 'Tourism rename changed relation identity for %.', guarded.target_name;
    end if;

    execute format('select count(*) from %s', guarded.target_name) into current_count;
    select relrowsecurity into current_rls
    from pg_class
    where oid = to_regclass(guarded.target_name);

    if current_count <> guarded.row_count or current_rls <> guarded.rls_enabled then
      raise exception 'Tourism rename validation failed for %.', guarded.target_name;
    end if;
  end loop;
end
$$;

commit;
