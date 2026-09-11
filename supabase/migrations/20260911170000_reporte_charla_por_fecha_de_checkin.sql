-- El reporte de asistencia agrupaba por events.starts_at, la fecha del EVENTO.
-- Con las charlas recurrentes eso se rompe: expand-recurrence.ts expande la
-- serie VIRTUALMENTE (nunca escribe una fila por ocurrencia), así que todos los
-- check-ins de todas las semanas se cuelgan de la MISMA fila madre y el reporte
-- los mete todos en la semana de esa madre.
--
-- Hoy no se nota porque las series arrancaron el 8-set y solo llevan una semana.
-- A partir de la segunda, cada semana nueva se apila sobre la primera: una
-- semana gigante y las siguientes en cero.
--
-- La fecha correcta es la del CHECK-IN, que es cuando la persona estuvo ahí. Es
-- además la que ya usa refresh_member_sedes, así que el reporte y las sedes
-- pasan a leer el mismo dato.
--
-- HORA DE COSTA RICA, no UTC. Una charla de domingo a las 6pm CR es lunes 00:00
-- en UTC: sin convertir, se contaría en la semana siguiente. Hoy ninguna fila
-- se corre (verificado: 0 de 172.168), porque el histórico se importó con la
-- hora del evento al mediodía; pero los check-ins REALES son de noche y ahí sí
-- cambia.
--
-- Impacto en el histórico: NINGUNO. De 172.168 check-ins de charla, 7 caen en un
-- día civil distinto al de su evento y 0 cambian de semana ISO.
CREATE OR REPLACE FUNCTION public.report_charla_attendance()
 RETURNS TABLE(yr integer, title text, wk integer, mo integer, checkins bigint, calidad text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select extract(year  from ec.checked_in_at at time zone 'America/Costa_Rica')::int as yr,
         coalesce(se.name, e.title)                                                  as title,
         extract(week  from ec.checked_in_at at time zone 'America/Costa_Rica')::int as wk,
         extract(month from ec.checked_in_at at time zone 'America/Costa_Rica')::int as mo,
         count(ec.id)::bigint                                                        as checkins,
         -- Los históricos no tienen el dato (la columna es de 2026-09-10):
         -- cuentan como asistentes, que es el default de la columna.
         coalesce(ec.checked_in_as, 'asistente')                                     as calidad
  from events e
  join event_checkins ec on ec.event_id = e.id
  left join sub_events se on se.id = ec.sub_event_id
  where e.event_type = 'charla'
    and ec.checked_in_at is not null
  group by 1, 2, 3, 4, 6
$function$;
