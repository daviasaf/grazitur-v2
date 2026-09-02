create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create table if not exists private.grazitur_user_encrypted_backup (
  backup_set text not null,
  user_id integer not null,
  cpf_ciphertext text not null,
  cpf_blind_index text not null,
  cpf_key_version integer not null,
  cpf_last4 text,
  cpf_context_id uuid not null,
  pii_ciphertext text not null,
  pii_key_version integer not null,
  pii_context_id uuid not null,
  captured_at timestamptz not null default now(),
  primary key (backup_set, user_id)
);

create table if not exists private.grazitur_log_encrypted_backup (
  backup_set text not null,
  log_id text not null,
  content_ciphertext text not null,
  content_key_version integer not null,
  content_context_id uuid not null,
  captured_at timestamptz not null default now(),
  primary key (backup_set, log_id)
);

create table if not exists private.grazitur_waitlist_encrypted_backup (
  backup_set text not null,
  excursion_id integer not null,
  content_ciphertext text not null,
  content_key_version integer not null,
  content_context_id uuid not null,
  captured_at timestamptz not null default now(),
  primary key (backup_set, excursion_id)
);

alter table private.grazitur_user_encrypted_backup enable row level security;
alter table private.grazitur_log_encrypted_backup enable row level security;
alter table private.grazitur_waitlist_encrypted_backup enable row level security;

revoke all on all tables in schema private from public, anon, authenticated, service_role;
