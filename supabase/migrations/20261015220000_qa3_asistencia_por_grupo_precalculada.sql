-- QA-3/M3 (2026-10-15) · El reporte de Retención dejaba de recorrer los
-- 176.731 check-ins en cada apertura.
--
-- get_group_attendance() juntaba event_checkins × events × members completos y
-- agrupaba por persona/año/grupo de edad: 0,5 a 2,4 s por llamada, con derrame a
-- disco (temp read/written 704), 1.602 llamadas y 868 s acumulados en prod. El
-- reporte compara AÑOS completos, así que un rango de fechas no servía: necesita
-- todo el historial.
--
-- Ahora el cálculo vive en una vista materializada que se refresca cada noche
-- con pg_cron (00:50 hora de Costa Rica, junto a refresh-member-sedes y
-- refresh-donor-flags), y la función lee de ahí. Consecuencia aceptada: los
-- check-ins del día entran al reporte esa noche.
--
-- La vista va en el esquema `private`: PostgREST publica `public`, y una vista
-- con la asistencia de toda la organización no puede quedar al alcance de la
-- llave pública (ver SEC-3 en AGENTS.md).

create materialized view if not exists private.asistencia_por_grupo as
  with charla as (
    select
      ec.member_id,
      extract(year from (e.starts_at at time zone 'America/Costa_Rica'))::int as yr,
      floor(((e.starts_at at time zone 'America/Costa_Rica')::date - m.birth_date) / 365.25)::int as age
    from event_checkins ec
    join events  e on e.id = ec.event_id
    join members m on m.id = ec.member_id
    where e.event_type = 'charla'
      and e.starts_at is not null
      and ec.member_id is not null
      and m.birth_date is not null
      and m.is_system is not true
  ),
  visit_counts as (
    select member_id, count(*) as total_visits from charla group by member_id having count(*) > 1
  ),
  classified as (
    select c.member_id, c.yr, c.age,
      case
        when c.age between 2  and 4  then 'G1a'
        when c.age between 5  and 8  then 'G1b'
        when c.age between 9  and 12 then 'G1c'
        when c.age between 13 and 17 then 'G2'
        when c.age between 18 and 32 then 'G3'
        when c.age > 32              then 'G4'
      end as grp
    from charla c join visit_counts v on v.member_id = c.member_id
    where c.age >= 2
  )
  select member_id as person_id, yr, grp, count(*)::int as visits, max(age)::int as max_age
  from classified
  where grp is not null
  group by member_id, yr, grp
with data;

-- Índice único: lo pide REFRESH ... CONCURRENTLY, que no bloquea lecturas
-- mientras se recalcula.
create unique index if not exists asistencia_por_grupo_uniq
  on private.asistencia_por_grupo (person_id, yr, grp);

revoke all on private.asistencia_por_grupo from public, anon, authenticated;

create or replace function public.get_group_attendance()
 returns table(person_id uuid, yr integer, grp text, visits integer, max_age integer)
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select person_id, yr, grp, visits, max_age from private.asistencia_por_grupo
$$;

revoke execute on function public.get_group_attendance() from public, anon, authenticated;
grant  execute on function public.get_group_attendance() to service_role;

create or replace function public.refresh_asistencia_por_grupo()
 returns void
 language sql
 security definer
 set search_path to 'public'
as $$
  refresh materialized view concurrently private.asistencia_por_grupo
$$;

revoke execute on function public.refresh_asistencia_por_grupo() from public, anon, authenticated;
grant  execute on function public.refresh_asistencia_por_grupo() to service_role;

-- pg_cron: 06:50 UTC = 00:50 en Costa Rica. Idempotente: si ya existe, se
-- reprograma con el mismo nombre.
select cron.schedule('refresh-asistencia-por-grupo', '50 6 * * *', 'select public.refresh_asistencia_por_grupo()');
