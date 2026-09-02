create view public.turismo_users
with (security_invoker = true)
as select * from public."User";

create view public.turismo_excursions
with (security_invoker = true)
as select * from public."Excursao";

create view public.turismo_system_logs
with (security_invoker = true)
as select * from public."SystemLog";

create view public.turismo_excursion_users
with (security_invoker = true)
as
select
  "A" as excursion_id,
  "B" as user_id
from public."_UserExcursao";

create view public.turismo_user_kinships
with (security_invoker = true)
as
select
  "A" as user_id,
  "B" as relative_user_id
from public."_UserKinship";

revoke all on
  public.turismo_users,
  public.turismo_excursions,
  public.turismo_system_logs,
  public.turismo_excursion_users,
  public.turismo_user_kinships
from public, anon, authenticated, service_role;

comment on view public.turismo_users is
  'Temporary security-invoker compatibility view used during the GraziTur table-prefix cutover.';
comment on view public.turismo_excursions is
  'Temporary security-invoker compatibility view used during the GraziTur table-prefix cutover.';
comment on view public.turismo_system_logs is
  'Temporary security-invoker compatibility view used during the GraziTur table-prefix cutover.';
comment on view public.turismo_excursion_users is
  'Temporary security-invoker compatibility view used during the GraziTur table-prefix cutover.';
comment on view public.turismo_user_kinships is
  'Temporary security-invoker compatibility view used during the GraziTur table-prefix cutover.';
