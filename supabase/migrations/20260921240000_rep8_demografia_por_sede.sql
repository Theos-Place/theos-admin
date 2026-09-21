-- REP-8 · Demografía de quienes asistieron, por sede.
--
-- Personas ÚNICAS, no check-ins: alguien que vino ocho veces a Cartago es una
-- persona en Cartago, no ocho. Y si asistió a dos sedes en el período cuenta en
-- las dos — para cada sede esa persona estuvo ahí.
--
-- La edad y el género vienen crudos (fecha de nacimiento y letra). El promedio
-- se calcula en TypeScript, que es donde está la regla de qué hacer con quien
-- no tiene fecha: dejarlo FUERA del promedio, no contarlo como 0.
create or replace function public.report_demografia_por_sede(
  p_desde date,
  p_hasta date
)
returns table (
  title text,
  member_id uuid,
  birth_date date,
  gender text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select distinct
         case when se.name is null or btrim(se.name) = '' then e.title
              else e.title || ' ' || btrim(se.name) end as title,
         m.id,
         m.birth_date,
         m.gender
  from event_checkins ec
  join events e on e.id = ec.event_id
  left join sub_events se on se.id = ec.sub_event_id
  join members m on m.id = ec.member_id
  where e.event_type = 'charla'
    and ec.checked_in_at is not null
    and (ec.checked_in_at at time zone 'America/Costa_Rica')::date between p_desde and p_hasta
    and m.first_name not ilike '%[prueba]%'
    and m.last_name  not ilike '%[prueba]%'
$$;

revoke execute on function public.report_demografia_por_sede(date, date) from public, anon, authenticated;
grant  execute on function public.report_demografia_por_sede(date, date) to service_role;
