-- REP-15 (ampliación, pedido de Floriana el 2026-10-12) · Cuántas PERSONAS
-- hay detrás de los check-ins de cada semana.
--
-- POR QUÉ NO SE PUEDE DERIVAR DE LO QUE YA HAY. `report_charla_attendance`
-- agrupa por sede y semana, y las personas únicas NO SE SUMAN entre grupos:
-- quien fue a dos sedes la misma semana cuenta en las dos. Medido en la
-- semana 40 de 2026: sumar las personas de cada sede da 899, que es
-- exactamente el número de check-ins, no las 875 personas reales. Sumar esa
-- columna daría siempre el total de check-ins y parecería correcto.
--
-- Por eso va aparte, agrupada SOLO por semana: es el único nivel en el que
-- «personas únicas» significa algo.
--
-- Mismo universo y mismo corte de semana que report_charla_attendance
-- (event_type = 'charla', isoyear/week en hora de Costa Rica), para que los
-- dos números de la pantalla hablen de la misma semana.

create or replace function public.report_charla_personas_por_semana()
returns table(iso_yr integer, wk integer, personas bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select extract(isoyear from ec.checked_in_at at time zone 'America/Costa_Rica')::int as iso_yr,
         extract(week    from ec.checked_in_at at time zone 'America/Costa_Rica')::int as wk,
         count(distinct ec.member_id)::bigint                                          as personas
  from events e
  join event_checkins ec on ec.event_id = e.id
  where e.event_type = 'charla'
    and ec.checked_in_at is not null
    and ec.member_id is not null
  group by 1, 2
$function$;

revoke execute on function public.report_charla_personas_por_semana() from public, anon, authenticated;
grant  execute on function public.report_charla_personas_por_semana() to service_role;
alter  function public.report_charla_personas_por_semana() set search_path to 'public';
