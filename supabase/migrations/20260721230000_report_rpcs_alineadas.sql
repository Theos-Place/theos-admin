-- Alinea las RPCs de los reportes de Discípulos y Retención con las reglas
-- centrales del sistema (2026-07-21):
--   · "Comprometido" = criterio central de asistencia (event_checkins.checked_in_at,
--     ventana y recencia pasadas como parámetros desde TS = ancladas a HOY), no
--     una ventana móvil anclada a la última charla ni events.starts_at.
--   · Hitos: tiempo desde la PRIMERA ASISTENCIA real (min checked_in_at), no
--     members.created_at (no confiable por el batch de importación).
--   · Cortes de año en zona horaria America/Costa_Rica.

-- get_dm_flags: recibe la ventana ya calculada en TS (p_oldest, p_recency, p_min)
-- con los defaults centrales (6 meses calendario / 60 días / 6). Comprometido usa
-- checked_in_at, exactamente como active_attendance_member_ids.
drop function if exists public.get_dm_flags(date);
drop function if exists public.get_dm_flags(timestamptz, timestamptz, integer);
create function public.get_dm_flags(
  p_oldest timestamptz,
  p_recency timestamptz,
  p_min integer
)
returns table (
  person_id uuid,
  es_comprometido boolean,
  sirve boolean,
  dona boolean,
  es_dm boolean,
  cohort_year int
)
language sql
stable
security definer
set search_path = public
as $$
  with charla as (
    select ec.member_id, ec.checked_in_at
    from event_checkins ec
    join events e on e.id = ec.event_id
    where e.event_type = 'charla'
      and ec.member_id is not null
  ),
  comprometidos as (
    select member_id
    from charla
    where checked_in_at >= p_oldest
    group by member_id
    having count(*) >= p_min
       and max(checked_in_at) >= p_recency
  ),
  servidores as (
    select distinct member_id from volunteers where status = 'active' and member_id is not null
  ),
  donadores as (
    select id as member_id from members where is_donor = true
  ),
  first_att as (
    select member_id,
           extract(year from min(checked_in_at at time zone 'America/Costa_Rica'))::int as cohort_year
    from charla group by member_id
  )
  select
    p.id,
    (co.member_id is not null),
    (s.member_id  is not null),
    (d.member_id  is not null),
    (co.member_id is not null and s.member_id is not null and d.member_id is not null),
    fa.cohort_year
  from members p
  left join comprometidos co on co.member_id = p.id
  left join servidores   s  on s.member_id  = p.id
  left join donadores    d  on d.member_id  = p.id
  left join first_att    fa on fa.member_id = p.id
  where p.is_system is not true;
$$;

revoke all on function public.get_dm_flags(timestamptz, timestamptz, integer) from public, anon, authenticated;

-- get_dm_milestones: días promedio desde la PRIMERA ASISTENCIA (min checked_in_at)
-- hasta cada hito. p_min = umbral de "comprometido" (fecha de la p_min-ésima charla).
drop function if exists public.get_dm_milestones();
drop function if exists public.get_dm_milestones(integer);
create function public.get_dm_milestones(p_min integer)
returns table (milestone text, avg_days numeric, n int)
language sql
stable
security definer
set search_path = public
as $$
  with charla as (
    select ec.member_id, ec.checked_in_at::date as d
    from event_checkins ec
    join events e on e.id = ec.event_id
    where e.event_type = 'charla' and ec.member_id is not null
  ),
  first_att as (
    select member_id, min(d) as first_date from charla group by member_id
  ),
  ranked as (
    select member_id, d, row_number() over (partition by member_id order by d) as rn from charla
  ),
  m_committed as (   -- fecha de la p_min-ésima charla
    select member_id, d as reached from ranked where rn = p_min
  ),
  m_n1 as (
    select se.member_id, min(se.completed_at::date) as reached
    from study_enrollments se
    join study_plans sp on sp.id = se.plan_id
    where sp.code = 'N1' and se.completed_at is not null
    group by se.member_id
  ),
  m_service as (
    select member_id, min(start_date::date) as reached
    from volunteers where start_date is not null and member_id is not null group by member_id
  ),
  m_donation as (
    select member_id, min(donation_date::date) as reached
    from donations where member_id is not null and donation_date is not null group by member_id
  ),
  all_ms as (
    select 'comprometido' as milestone, (mc.reached - fa.first_date) as days
      from m_committed mc join first_att fa on fa.member_id = mc.member_id
    union all
    select 'nivel1', (mn.reached - fa.first_date)
      from m_n1 mn join first_att fa on fa.member_id = mn.member_id
    union all
    select 'servicio', (ms.reached - fa.first_date)
      from m_service ms join first_att fa on fa.member_id = ms.member_id
    union all
    select 'donacion', (md.reached - fa.first_date)
      from m_donation md join first_att fa on fa.member_id = md.member_id
  )
  select milestone, round(avg(days)::numeric, 0) as avg_days, count(*)::int as n
  from all_ms
  where days is not null and days >= 0
  group by milestone;
$$;

revoke all on function public.get_dm_milestones(integer) from public, anon, authenticated;

-- get_group_attendance: cortes de año y edad en zona horaria America/Costa_Rica.
create or replace function public.get_group_attendance()
returns table (person_id uuid, yr int, grp text, visits int, max_age int)
language sql
stable
security definer
set search_path = public
as $$
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
  group by member_id, yr, grp;
$$;

-- get_active_today: miembros que "siguen asistiendo" según el criterio nuevo
-- (≥ p_min check-ins de charla desde p_oldest). Para el flujo de retención.
drop function if exists public.get_active_today(timestamptz, integer);
create function public.get_active_today(p_oldest timestamptz, p_min integer)
returns table (member_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select ec.member_id
  from event_checkins ec
  join events e on e.id = ec.event_id
  where e.event_type = 'charla'
    and ec.member_id is not null
    and ec.checked_in_at >= p_oldest
  group by ec.member_id
  having count(*) >= p_min;
$$;

revoke all on function public.get_active_today(timestamptz, integer) from public, anon, authenticated;
