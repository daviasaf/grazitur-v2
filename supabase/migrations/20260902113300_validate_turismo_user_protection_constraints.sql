alter table public.turismo_users
  validate constraint turismo_users_cpf_last4_check;

alter table public.turismo_users
  validate constraint turismo_users_cpf_protection_consistency_check;

alter table public.turismo_users
  validate constraint turismo_users_pii_envelope_consistency_check;
