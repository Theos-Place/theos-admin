-- REP-5/REP-8 · Agregar la EDAD a las listas de la semana.
--
-- Pedida el 2026-09-22 para las listas de retención: quien llama a alguien que
-- dejó de venir necesita saber si habla con un chico de 15 o con un adulto —
-- cambia quién llama y qué se dice.
--
-- Hay que DROPEAR y recrear porque cambia el `returns table`; Postgres no deja
-- alterar la forma de una función. Y por eso los permisos se vuelven a aplicar
-- abajo: el drop se los lleva, y una función nueva en `public` nace con EXECUTE
-- para PUBLIC y expuesta por PostgREST (ver AGENTS.md).

drop function if exists public.report_asistentes_de_la_semana(date, date);

create function public.report_asistentes_de_la_semana(
  p_desde date,
  p_hasta date
)
returns table (
  member_id uuid,
  nombre text,
  telefono text,
  email text,
  sedes text[],
  regreso date,
  visitas bigint,
  edad int
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with de_la_semana as (
    select ec.member_id,
           case when se.name is null or btrim(se.name) = '' then e.title
                else e.title || ' ' || btrim(se.name) end as title
    from event_checkins ec
    join events e on e.id = ec.event_id
    left join sub_events se on se.id = ec.sub_event_id
    where e.event_type = 'charla'
      and ec.member_id is not null
      and ec.checked_in_at is not null
      and (ec.checked_in_at at time zone 'America/Costa_Rica')::date between p_desde and p_hasta
  ),
  agrupado as (
    select d.member_id, array_agg(distinct d.title) as sedes
    from de_la_semana d group by d.member_id
  )
  select a.member_id,
         btrim(m.first_name || ' ' || m.last_name) as nombre,
         m.phone,
         m.email,
         a.sedes,
         (
           select min((ec2.checked_in_at at time zone 'America/Costa_Rica')::date)
           from event_checkins ec2
           join events e2 on e2.id = ec2.event_id
           where ec2.member_id = a.member_id
             and e2.event_type = 'charla'
             and ec2.checked_in_at is not null
             and (ec2.checked_in_at at time zone 'America/Costa_Rica')::date > p_hasta
         ) as regreso,
         (
           select count(*) from event_checkins ec3
           join events e3 on e3.id = ec3.event_id
           where ec3.member_id = a.member_id
             and e3.event_type = 'charla'
             and ec3.checked_in_at is not null
         )::bigint as visitas,
         -- Años cumplidos. `age()` cuenta el cumpleaños, así que no hay
         -- off-by-one en enero. NULL cuando la ficha no tiene fecha: hay 3.260
         -- así, y poner 0 las haría parecer recién nacidas en la lista.
         case when m.birth_date is null then null
              else date_part('year', age(m.birth_date))::int end as edad
  from agrupado a
  join members m on m.id = a.member_id
  where m.first_name not ilike '%[prueba]%'
    and m.last_name  not ilike '%[prueba]%'
  order by 2
$$;

revoke execute on function public.report_asistentes_de_la_semana(date, date) from public, anon, authenticated;
grant  execute on function public.report_asistentes_de_la_semana(date, date) to service_role;
