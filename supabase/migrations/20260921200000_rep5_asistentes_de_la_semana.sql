-- REP-5 · Quiénes asistieron en una semana, y cuándo volvieron.
--
-- Una sola consulta para las DOS listas de la pantalla: los asistentes de la
-- semana salen tal cual, y los abandonos se derivan en TypeScript comparando
-- `regreso` contra el cierre de la ventana (ver lib/reports/abandonos.ts). La
-- regla de negocio no baja a SQL a propósito: acá vive el dato, allá la
-- decisión, y la decisión es la que tiene tests.
--
-- `regreso` es el PRIMER check-in de charla después del domingo de la semana.
-- Se calcula con un lateral por persona y no trayendo 168k check-ins al
-- cliente.
create or replace function public.report_asistentes_de_la_semana(
  p_desde date,
  p_hasta date
)
returns table (
  member_id uuid,
  nombre text,
  telefono text,
  email text,
  sedes text[],
  regreso date
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with de_la_semana as (
    select ec.member_id,
           -- Mismo título compuesto que report_charla_attendance: el sub-evento
           -- dice qué es ("Youth") y el evento de dónde. La sede se deriva del
           -- título en TS con sedeFromTitle(), que es la única definición.
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
         ) as regreso
  from agrupado a
  join members m on m.id = a.member_id
  -- Los datos de prueba no son gente a la que haya que llamar.
  where m.first_name not ilike '%[prueba]%'
    and m.last_name  not ilike '%[prueba]%'
  order by 2
$$;

-- Una función creada en `public` nace con EXECUTE para PUBLIC y PostgREST la
-- publica en /rest/v1/rpc/. Esta devuelve teléfonos y correos: cerrarla no es
-- higiene, es el punto. Ver AGENTS.md y SEC-3 (2026-09-17).
revoke execute on function public.report_asistentes_de_la_semana(date, date) from public, anon, authenticated;
grant  execute on function public.report_asistentes_de_la_semana(date, date) to service_role;
