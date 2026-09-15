-- El reporte de charlas mezclaba el año CALENDARIO con la semana ISO.
--
-- `yr` salía de extract(year) y `wk` de extract(week), que es la semana ISO. Las
-- dos cosas no coinciden en el borde del año: los check-ins del 3 de enero de
-- 2021 —13 de ellos, ya en la base— aparecen como "semana 53 de 2021", y 2021
-- no tiene semana 53. Es la semana 53 de 2020. Lo mismo va a pasar del 1 al 3
-- de enero de 2027.
--
-- Se agrega `iso_yr` en vez de cambiar `yr`: los dos hacen falta y significan
-- cosas distintas. El total del año y el desglose por mes son calendario —"la
-- asistencia de 2026" es enero a diciembre—, mientras que la serie semanal
-- tiene que ir por año ISO o el número de semana no cierra.

-- Agregar una columna al RETURNS TABLE cambia la firma, y Postgres no deja
-- hacerlo con CREATE OR REPLACE: hay que soltar la función primero.
drop function if exists public.report_charla_attendance();

create function public.report_charla_attendance()
returns table(yr integer, iso_yr integer, title text, wk integer, mo integer, checkins bigint, calidad text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select extract(year    from ec.checked_in_at at time zone 'America/Costa_Rica')::int as yr,
         -- Año al que pertenece la SEMANA, que no siempre es el del día.
         extract(isoyear from ec.checked_in_at at time zone 'America/Costa_Rica')::int as iso_yr,
         coalesce(se.name, e.title)                                                    as title,
         extract(week    from ec.checked_in_at at time zone 'America/Costa_Rica')::int as wk,
         extract(month   from ec.checked_in_at at time zone 'America/Costa_Rica')::int as mo,
         count(ec.id)::bigint                                                          as checkins,
         -- Los históricos no tienen el dato (la columna es de 2026-09-10):
         -- cuentan como asistentes, que es el default de la columna.
         coalesce(ec.checked_in_as, 'asistente')                                       as calidad
  from events e
  join event_checkins ec on ec.event_id = e.id
  left join sub_events se on se.id = ec.sub_event_id
  where e.event_type = 'charla'
    and ec.checked_in_at is not null
  group by 1, 2, 3, 4, 5, 7
$function$;
