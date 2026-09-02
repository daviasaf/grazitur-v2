create schema if not exists private;

create or replace function private.grazitur_jsonb_has_sensitive_keys(payload jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog, private
as $$
declare
  entry record;
begin
  if jsonb_typeof(payload) = 'object' then
    for entry in select key, value from jsonb_each(payload)
    loop
      if entry.key = any (
        array[
          'nome', 'name', 'cpf', 'celular', 'telefone', 'phone', 'email',
          'rg', 'orgaoExpeditor', 'nascimento', 'cidade', 'endereco', 'idade'
        ]::text[]
      ) or private.grazitur_jsonb_has_sensitive_keys(entry.value) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(payload) = 'array' then
    for entry in select value from jsonb_array_elements(payload)
    loop
      if private.grazitur_jsonb_has_sensitive_keys(entry.value) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end
$$;

revoke all on function private.grazitur_jsonb_has_sensitive_keys(jsonb)
  from public, anon, authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'User_protected_storage_required'
      and conrelid = 'public."User"'::regclass
  ) then
    alter table public."User"
      add constraint "User_protected_storage_required"
      check (
        cpf is null
        and nome = 'Dado Protegido'
        and email is null
        and rg is null
        and "orgaoExpeditor" is null
        and nascimento is null
        and celular is null
        and cidade is null
        and endereco is null
        and idade is null
        and pii_ciphertext is not null
        and pii_key_version is not null
        and pii_context_id is not null
        and cpf_context_id is not null
        and (
          (
            cpf_ciphertext is not null
            and cpf_blind_index is not null
            and cpf_key_version is not null
            and cpf_last4 is not null
          )
          or
          (
            cpf_ciphertext is null
            and cpf_blind_index is null
            and cpf_key_version is null
            and cpf_last4 is null
          )
        )
      ) not valid;

    alter table public."User"
      validate constraint "User_protected_storage_required";
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'SystemLog_protected_storage_required'
      and conrelid = 'public."SystemLog"'::regclass
  ) then
    alter table public."SystemLog"
      add constraint "SystemLog_protected_storage_required"
      check (
        title = 'Registro protegido'
        and detail is null
        and content_ciphertext is not null
        and content_key_version is not null
        and content_context_id is not null
      ) not valid;

    alter table public."SystemLog"
      validate constraint "SystemLog_protected_storage_required";
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'Excursao_waitlist_without_personal_data'
      and conrelid = 'public."Excursao"'::regclass
  ) then
    alter table public."Excursao"
      add constraint "Excursao_waitlist_without_personal_data"
      check (
        jsonb_typeof(coalesce("listaEsperaJson", '[]')::jsonb) = 'array'
        and not private.grazitur_jsonb_has_sensitive_keys(
          coalesce("listaEsperaJson", '[]')::jsonb
        )
      ) not valid;

    alter table public."Excursao"
      validate constraint "Excursao_waitlist_without_personal_data";
  end if;
end
$$;
