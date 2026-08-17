begin;

alter table public."User"
  add column if not exists pii_ciphertext text,
  add column if not exists pii_key_version integer,
  add column if not exists pii_context_id uuid;

create unique index if not exists "User_pii_context_id_key"
  on public."User" (pii_context_id)
  where pii_context_id is not null;

alter table public."User"
  drop constraint if exists "User_pii_envelope_consistency_check";

alter table public."User"
  add constraint "User_pii_envelope_consistency_check"
  check (
    (pii_ciphertext is null and pii_key_version is null)
    or
    (pii_ciphertext is not null and pii_key_version is not null and pii_context_id is not null)
  ) not valid;

comment on column public."User".pii_ciphertext is
  'AES-256-GCM envelope containing the encrypted personal profile; never expose through the Data API.';
comment on column public."User".pii_key_version is
  'Application encryption key version used for pii_ciphertext.';
comment on column public."User".pii_context_id is
  'Random stable identifier bound to the authenticated-encryption AAD.';

commit;
