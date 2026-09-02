create or replace function private.turismo_jsonb_has_sensitive_keys(payload jsonb)
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
      ) or private.turismo_jsonb_has_sensitive_keys(entry.value) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(payload) = 'array' then
    for entry in select value from jsonb_array_elements(payload)
    loop
      if private.turismo_jsonb_has_sensitive_keys(entry.value) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end
$$;

revoke all on function private.turismo_jsonb_has_sensitive_keys(jsonb)
  from public, anon, authenticated, service_role;
