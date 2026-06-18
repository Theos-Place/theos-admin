-- Reporte de Control de Asistencia, consciente de subeventos: la "sede/grupo" es el
-- NOMBRE DEL SUBEVENTO cuando el check-in lo trae (sub_event_id), o el título del
-- evento si no. Agregado COMPACTO de check-ins de charla por (año calendario,
-- etiqueta, semana ISO, mes) — nunca check-ins crudos. La sede final (canónica) se
-- resuelve en la app desde la etiqueta (sedes-canonical).
--
-- Hoy las charlas de niños/youth viven como títulos distintos (United Youth, Heredia
-- Youth, …) y aparecen como filas propias; cuando pasen a registrarse como subeventos
-- de una charla padre, se atribuyen al subevento automáticamente sin tocar código.
create or replace function report_charla_attendance()
returns table(yr int, title text, wk int, mo int, checkins bigint)
language sql
stable
security definer
set search_path = public
as $$
  select extract(year  from e.starts_at)::int  as yr,
         coalesce(se.name, e.title)             as title,
         extract(week  from e.starts_at)::int  as wk,
         extract(month from e.starts_at)::int  as mo,
         count(ec.id)::bigint                    as checkins
  from events e
  join event_checkins ec on ec.event_id = e.id
  left join sub_events se on se.id = ec.sub_event_id
  where e.event_type = 'charla'
    and e.starts_at is not null
  group by 1, 2, 3, 4
$$;

comment on function report_charla_attendance() is
  'Agregado de check-ins de charla por (año, etiqueta=subevento||título, semana ISO, mes) para el reporte de Control de Asistencia. La sede se deriva de la etiqueta en la app (sedes-canonical).';
