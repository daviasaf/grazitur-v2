-- Expand phase only. Applying this file to any remote environment requires the
-- approval gate documented in docs/security/grazitur-data-protection.md.
begin;

alter table public."User"
  alter column cpf drop not null,
  add column if not exists cpf_ciphertext text,
  add column if not exists cpf_blind_index text,
  add column if not exists cpf_key_version integer,
  add column if not exists cpf_last4 text,
  add column if not exists cpf_context_id uuid;

create unique index if not exists "User_cpf_blind_index_key"
  on public."User" (cpf_blind_index)
  where cpf_blind_index is not null;

create unique index if not exists "User_cpf_context_id_key"
  on public."User" (cpf_context_id)
  where cpf_context_id is not null;

alter table public."User"
  drop constraint if exists "User_cpf_last4_check",
  add constraint "User_cpf_last4_check"
    check (cpf_last4 is null or cpf_last4 ~ '^[0-9]{4}$') not valid,
  drop constraint if exists "User_cpf_protection_consistency_check",
  add constraint "User_cpf_protection_consistency_check"
    check (
      (cpf_ciphertext is null and cpf_blind_index is null and cpf_key_version is null)
      or
      (cpf_ciphertext is not null and cpf_blind_index is not null and cpf_key_version is not null and cpf_context_id is not null)
    ) not valid;

comment on column public."User".cpf is
  'LEGACY expand/contract column. Remove only after encrypted backfill, cutover, reconciliation and explicit approval.';
comment on column public."User".cpf_ciphertext is
  'AES-256-GCM authenticated envelope produced by the trusted GraziTur backend.';
comment on column public."User".cpf_blind_index is
  'Versioned HMAC-SHA-256 blind index for exact lookup and uniqueness.';
comment on column public."User".cpf_context_id is
  'Random record context bound into AEAD associated data; not a secret.';

commit;
