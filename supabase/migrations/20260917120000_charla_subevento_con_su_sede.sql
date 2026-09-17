-- El sub-evento "Youth" no dice de qué sede es, y por eso las tres se mezclaban
-- en una sola barra.
--
-- QUÉ PASÓ. Hasta la semana 36 de 2026 cada youth era un EVENTO propio
-- ("Cartago Youth", "Heredia Youth", "United Youth"), así que el reporte los
-- separaba bien. Desde la semana 37 se pasó a un evento por sede con un
-- SUB-EVENTO adentro, y el único nombre en uso es "Youth" — el mismo bajo tres
-- eventos distintos:
--
--   Charla Cartago Miércoles   → sub-evento "Youth"
--   Charla Pedregal Domingo    → sub-evento "Youth"
--   Charla Pedregal Miércoles  → sub-evento "Youth"
--
-- El reporte etiquetaba con `coalesce(se.name, e.title)`, o sea "Youth" a
-- secas: los tres colapsaban en una barra y se perdía cuál era cuál. Por eso
-- "no sale dividida cada youth, sale una única".
--
-- LA SALIDA. Cuando hay sub-evento, la etiqueta es EVENTO + SUB-EVENTO:
-- "Charla Pedregal Domingo Youth". Eso además empalma con el histórico, porque
-- el diccionario de sedes (lib/sedes-canonical.ts) ya mapea los nombres viejos
-- a esos mismos canónicos: 'united youth' → 'Charla Pedregal Domingo Youth'.
-- Así la serie de cada youth es CONTINUA a través del cambio de modelo, en vez
-- de cortarse en la semana 37 y reaparecer con otro nombre.
--
-- Ojo: esto cambia el agregado, así que hay que refrescar report_snapshots
-- después de aplicarlo (el reporte lee del snapshot nocturno, no del RPC).

create or replace function public.report_charla_attendance()
returns table(yr integer, iso_yr integer, title text, wk integer, mo integer, checkins bigint, calidad text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select extract(year    from ec.checked_in_at at time zone 'America/Costa_Rica')::int as yr,
         -- Año al que pertenece la SEMANA, que no siempre es el del día.
         extract(isoyear from ec.checked_in_at at time zone 'America/Costa_Rica')::int as iso_yr,
         -- Con sub-evento: "<evento> <sub-evento>". El sub-evento solo dice qué
         -- es ("Youth"), no de dónde; el evento aporta la sede.
         case when se.name is null or btrim(se.name) = '' then e.title
              else e.title || ' ' || btrim(se.name) end                                as title,
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
