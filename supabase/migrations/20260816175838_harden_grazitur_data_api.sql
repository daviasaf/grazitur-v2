-- The application uses trusted server-side Prisma connections, not the Data
-- API. This migration closes the accidental REST/GraphQL surface. Apply only
-- after approval and a compatibility test against every consumer.
begin;

revoke all privileges on table
  public."User",
  public."Excursao",
  public."SystemLog",
  public."_UserKinship",
  public."_UserExcursao"
from anon, authenticated, service_role;

revoke all privileges on sequence
  public."User_id_seq",
  public."Excursao_id_seq"
from anon, authenticated, service_role;

alter table public."User" enable row level security;
alter table public."Excursao" enable row level security;
alter table public."SystemLog" enable row level security;
alter table public."_UserKinship" enable row level security;
alter table public."_UserExcursao" enable row level security;

-- No permissive policies are created: these app tables are intentionally not
-- part of the Data API contract. Prisma's dedicated server connection remains
-- the only application path.

-- Default privileges are intentionally left unchanged here because this is a
-- shared schema. Global defaults must be coordinated with every other app or
-- moved to an application-owned schema in a separate approved change.

create or replace function public.trigger_formatar_nome_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nome := public.formatar_nome(new.nome);
  return new;
end;
$$;

alter function public.formatar_nome(text) set search_path = '';
revoke execute on function public.formatar_nome(text) from public, anon, authenticated, service_role;
revoke execute on function public.trigger_formatar_nome_user() from public, anon, authenticated, service_role;

commit;
