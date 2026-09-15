-- El reporte de crecimiento mostraba CERO personas nuevas en julio de 2026.
--
-- No era un bug de la pantalla: en la base no hay un solo perfil con created_at
-- en julio. Entre el 15 de junio y el 19 de agosto de 2026 nadie se creó en
-- este sistema —fue la ventana de la migración— y el 19 de agosto entraron 414
-- de golpe en una carga masiva. De esos 414, 163 tuvieron su primer check-in en
-- JULIO: son las personas nuevas de julio, con fecha de alta de agosto.
--
-- created_at es cuándo se creó la FILA, no cuándo llegó la persona. Para quien
-- entró por un import las dos cosas no coinciden, y el reporte las trataba como
-- si sí.
--
-- La fecha de alta pasa a ser la primera señal real que tenemos de la persona:
-- lo más temprano entre la creación del perfil, su primer check-in y su primera
-- matrícula. No se toca members.created_at, que es dato de auditoría.
--
-- Efecto medido antes de aplicar: 2026 pasa de (jun 145, jul 0, ago 423) a
-- (jun 233, jul 166, ago 235); 2023-2025 se mueven como mucho 3 personas en un
-- mes, o sea el histórico bueno queda igual.
--
-- De paso, el año y el mes se calculan en hora de Costa Rica. Con extract()
-- sobre el timestamptz en UTC, alguien registrado un 31 de agosto a las 7 p.m.
-- contaba como de setiembre.

create or replace function public.report_member_growth()
returns table(created_yr integer, created_mo integer, title text, new_members bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with member_sede as (
    select ec.member_id,
           coalesce(se.name, e.title) as title,
           row_number() over (
             partition by ec.member_id
             order by count(*) desc, coalesce(se.name, e.title)
           ) as rn
    from event_checkins ec
    join events e on e.id = ec.event_id and e.event_type = 'charla'
    left join sub_events se on se.id = ec.sub_event_id
    where ec.member_id is not null
    group by ec.member_id, coalesce(se.name, e.title)
  ),
  -- Agregados aparte y no subconsultas correlacionadas: son ~170 mil check-ins
  -- y el reporte se recalcula entero en cada snapshot.
  primer_checkin as (
    select member_id, min(checked_in_at) as f
    from event_checkins where member_id is not null group by member_id
  ),
  primera_matricula as (
    select member_id, min(created_at) as f
    from study_enrollments where member_id is not null group by member_id
  ),
  alta as (
    select m.id,
           least(m.created_at, pc.f, pm.f) at time zone 'America/Costa_Rica' as f
    from members m
    left join primer_checkin pc on pc.member_id = m.id
    left join primera_matricula pm on pm.member_id = m.id
    where m.created_at is not null
  )
  select extract(year  from a.f)::int as created_yr,
         extract(month from a.f)::int as created_mo,
         ms.title                     as title,
         count(*)::bigint             as new_members
  from alta a
  left join member_sede ms on ms.member_id = a.id and ms.rn = 1
  group by 1, 2, 3
$function$;
