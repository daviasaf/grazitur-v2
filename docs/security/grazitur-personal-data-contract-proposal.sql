-- NOT A MIGRATION YET.
-- Contract phase: destructive and allowed only after backup/restore evidence,
-- complete backfill, dual-read verification, reconciliation and explicit approval.

begin;

do $$
begin
  if exists (
    select 1 from public."User"
    where cpf is not null
      and (cpf_ciphertext is null or cpf_blind_index is null or cpf_key_version is null or cpf_context_id is null)
  ) then
    raise exception 'Contract blocked: legacy CPF rows still lack protected fields.';
  end if;

  if exists (
    select cpf_blind_index from public."User"
    where cpf_blind_index is not null
    group by cpf_blind_index having count(*) > 1
  ) then
    raise exception 'Contract blocked: duplicate blind indexes require reconciliation.';
  end if;
end;
$$;

alter table public."User" validate constraint "User_cpf_last4_check";
alter table public."User" validate constraint "User_cpf_protection_consistency_check";

-- Deploy the application with GRAZITUR_CPF_PROTECTION_MODE=required and verify
-- all readers before uncommenting the destructive statements below.
-- alter table public."User" drop constraint if exists "User_cpf_key";
-- alter table public."User" drop column cpf;

commit;
