-- Reporte "Retención y Transición en Grupos". RPC de solo-lectura que devuelve,
-- por persona / año / grupo etario, las visitas a charlas y la edad máxima en ese
-- grupo/año. La clasificación es SOLO por edad al momento de asistir
-- (starts_at − birth_date); youth/home no es un dato confiable en el esquema y,
-- como los rangos de edad no se solapan, la edad basta.
--
-- Exclusiones (según el documento):
--   · check-ins sin member_id (no hay: 100% tienen miembro) o de miembros sin
--     birth_date (~13% — no clasificables por edad).
--   · personas con UNA sola visita histórica total (ruido).
--   · edades < 2 (bebés / fechas erróneas) → sin grupo.
-- El módulo TS calcula únicos/año, retención año a año, flujo de transición y
-- proyección a partir de estas filas.
create or replace function public.get_group_attendance()
returns table (
  person_id uuid,
  yr int,
  grp text,
  visits int,
  max_age int
)
language sql
stable
security definer
set search_path = public
as $$
  with charla as (
    select
      ec.member_id,
      extract(year from e.starts_at)::int as yr,
      floor((e.starts_at::date - m.birth_date) / 365.25)::int as age
    from event_checkins ec
    join events  e on e.id = ec.event_id
    join members m on m.id = ec.member_id
    where e.event_type = 'charla'
      and e.starts_at is not null
      and ec.member_id is not null
      and m.birth_date is not null
      and m.is_system is not true
  ),
  -- Excluir a quienes tienen una sola visita histórica total.
  visit_counts as (
    select member_id, count(*) as total_visits
    from charla
    group by member_id
    having count(*) > 1
  ),
  classified as (
    select
      c.member_id,
      c.yr,
      c.age,
      case
        when c.age between 2  and 4  then 'G1a'
        when c.age between 5  and 8  then 'G1b'
        when c.age between 9  and 12 then 'G1c'
        when c.age between 13 and 17 then 'G2'
        when c.age between 18 and 32 then 'G3'
        when c.age > 32              then 'G4'
      end as grp
    from charla c
    join visit_counts v on v.member_id = c.member_id
    where c.age >= 2
  )
  select
    member_id as person_id,
    yr,
    grp,
    count(*)::int as visits,
    max(age)::int as max_age
  from classified
  where grp is not null
  group by member_id, yr, grp;
$$;

revoke all on function public.get_group_attendance() from public, anon, authenticated;
