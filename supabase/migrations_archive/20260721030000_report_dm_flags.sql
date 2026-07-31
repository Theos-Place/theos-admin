-- Reporte "Discípulos Multiplicadores" (DM). Dos RPCs de solo-lectura que
-- adaptan la definición del documento al esquema real de theos-admin:
--   · asistencia = event_checkins + events (event_type = 'charla'); la fecha es
--     events.starts_at (event_checkins no tiene fecha propia).
--   · sirve      = volunteers con status = 'active'.
--   · dona       = members.is_donor (flag ya recalculado: donó ~últimos 2 trim).
--   · Nivel 1    = study_enrollments completado de un study_plan con code 'N1'.
-- Se excluyen perfiles de sistema (members.is_system) y check-ins sin member_id
-- (invitados). Ninguna función muta datos.

-- get_dm_flags: una fila por persona con sus 4 flags + año de cohorte (primera
-- charla). ref_date NULL ⇒ se usa la última fecha de charla registrada.
create or replace function public.get_dm_flags(ref_date date default null)
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
  with cut as (
    select
      d as ref_d,
      d - interval '6 months' as c6,
      d - interval '60 days'  as c60
    from (
      select coalesce(
        ref_date,
        (select max(e.starts_at::date)
           from event_checkins ec
           join events e on e.id = ec.event_id
          where e.event_type = 'charla')
      ) as d
    ) r
  ),
  charla as (
    select ec.member_id, e.starts_at::date as d
    from event_checkins ec
    join events e on e.id = ec.event_id
    where e.event_type = 'charla'
      and ec.member_id is not null
  ),
  comprometidos as (
    select c.member_id
    from charla c
    cross join cut
    where c.d between cut.c6 and cut.ref_d
    group by c.member_id
    having count(*) >= 6
       and max(c.d) >= min(cut.c60)   -- cut.c60 es constante ⇒ min = su valor
  ),
  servidores as (
    select distinct member_id
    from volunteers
    where status = 'active' and member_id is not null
  ),
  donadores as (
    select id as member_id from members where is_donor = true
  ),
  first_att as (
    select member_id, extract(year from min(d))::int as cohort_year
    from charla
    group by member_id
  )
  select
    p.id,
    (co.member_id is not null) as es_comprometido,
    (s.member_id  is not null) as sirve,
    (d.member_id  is not null) as dona,
    (co.member_id is not null and s.member_id is not null and d.member_id is not null) as es_dm,
    fa.cohort_year
  from members p
  left join comprometidos co on co.member_id = p.id
  left join servidores   s  on s.member_id  = p.id
  left join donadores    d  on d.member_id  = p.id
  left join first_att    fa on fa.member_id = p.id
  where p.is_system is not true;
$$;

-- get_dm_milestones: tiempo PROMEDIO (en días) desde members.created_at hasta
-- cada hito, con el n de personas incluidas. Se excluyen días negativos o nulos.
-- "Primera asistencia comprometida" se aproxima por la fecha de la 6.ª charla
-- histórica de la persona (primer momento en que acumula el umbral de 6); es una
-- aproximación al "≥6 en 6 meses", suficiente para un promedio.
create or replace function public.get_dm_milestones()
returns table (
  milestone text,
  avg_days numeric,
  n int
)
language sql
stable
security definer
set search_path = public
as $$
  with charla as (
    select ec.member_id, e.starts_at::date as d
    from event_checkins ec
    join events e on e.id = ec.event_id
    where e.event_type = 'charla'
      and ec.member_id is not null
  ),
  ranked as (
    select member_id, d,
           row_number() over (partition by member_id order by d) as rn
    from charla
  ),
  m_committed as (   -- fecha de la 6.ª charla
    select member_id, d as reached from ranked where rn = 6
  ),
  m_n1 as (
    select se.member_id, min(se.completed_at::date) as reached
    from study_enrollments se
    join study_plans sp on sp.id = se.plan_id
    where sp.code = 'N1'
      and se.completed_at is not null
    group by se.member_id
  ),
  m_service as (
    select member_id, min(start_date::date) as reached
    from volunteers
    where start_date is not null and member_id is not null
    group by member_id
  ),
  m_donation as (
    select member_id, min(donation_date::date) as reached
    from donations
    where member_id is not null and donation_date is not null
    group by member_id
  ),
  all_ms as (
    select 'comprometido' as milestone, p.id, (mc.reached - p.created_at::date) as days
      from members p join m_committed mc on mc.member_id = p.id
    union all
    select 'nivel1', p.id, (mn.reached - p.created_at::date)
      from members p join m_n1 mn on mn.member_id = p.id
    union all
    select 'servicio', p.id, (ms.reached - p.created_at::date)
      from members p join m_service ms on ms.member_id = p.id
    union all
    select 'donacion', p.id, (md.reached - p.created_at::date)
      from members p join m_donation md on md.member_id = p.id
  )
  select milestone, round(avg(days)::numeric, 0) as avg_days, count(*)::int as n
  from all_ms
  where days is not null and days >= 0
  group by milestone;
$$;

revoke all on function public.get_dm_flags(date) from public, anon, authenticated;
revoke all on function public.get_dm_milestones() from public, anon, authenticated;
