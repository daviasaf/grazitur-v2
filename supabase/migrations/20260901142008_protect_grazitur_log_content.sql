alter table public."SystemLog"
  add column if not exists content_ciphertext text,
  add column if not exists content_key_version integer,
  add column if not exists content_context_id uuid;

create unique index if not exists "SystemLog_content_context_id_key"
  on public."SystemLog" (content_context_id)
  where content_context_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'SystemLog_content_envelope_complete'
      and conrelid = 'public."SystemLog"'::regclass
  ) then
    alter table public."SystemLog"
      add constraint "SystemLog_content_envelope_complete"
      check (
        (content_ciphertext is null and content_key_version is null and content_context_id is null)
        or
        (content_ciphertext is not null and content_key_version is not null and content_context_id is not null)
      ) not valid;
    alter table public."SystemLog"
      validate constraint "SystemLog_content_envelope_complete";
  end if;
end
$$;
