-- Destructive privacy cleanup. Run only after a restorable backup has been
-- proven and after explicit approval for production data changes.
begin;

do $$
begin
  if exists (
    select 1
    from public."Excursao" e
    cross join lateral jsonb_array_elements(coalesce(nullif(e."listaEsperaJson", ''), '[]')::jsonb) item
    where not (item ? 'userId') or nullif(item->>'userId', '') is null
  ) then
    raise exception 'Waitlist contains entries without userId; quarantine and resolve them before redaction.';
  end if;
end;
$$;

update public."SystemLog"
set detail = regexp_replace(
  regexp_replace(
    regexp_replace(detail, '[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}[- ]?[0-9]{2}', '[CPF REDIGIDO]', 'g'),
    '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[E-MAIL REDIGIDO]', 'gi'
  ),
  '([Cc][Pp][Ff]|[Cc]elular|[Ww]hats[Aa]pp)[^\n]*',
  '\1: [REDIGIDO]',
  'g'
)
where detail is not null
  and detail ~* 'cpf|celular|whatsapp|[0-9]{11}|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}';

update public."Excursao" e
set "listaEsperaJson" = coalesce((
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', item->>'id',
    'userId', (item->>'userId')::integer,
    'createdAt', item->>'createdAt',
    'origem', item->>'origem'
  )) order by ordinality)
  from jsonb_array_elements(coalesce(nullif(e."listaEsperaJson", ''), '[]')::jsonb)
    with ordinality as entries(item, ordinality)
), '[]'::jsonb)::text;

update public."Excursao" e
set "assinaturasJson" = coalesce((
  select jsonb_object_agg(key, case
    when jsonb_typeof(value) = 'object' then value - 'guiaCpf' - 'guiaCelular'
    else value
  end)
  from jsonb_each(coalesce(nullif(e."assinaturasJson", ''), '{}')::jsonb)
), '{}'::jsonb)::text;

commit;
