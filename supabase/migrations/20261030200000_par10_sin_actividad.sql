-- PAR-10 · «Ya no es de Theos»: las fichas sin actividad en N años (3 por
-- defecto). Decidido con Floriana el 2026-10-30:
--
--   · Actividad = check-in a una charla o evento, inscripción a un evento (por
--     la fecha del evento), o haber estado INSCRITO en un estudio (aunque no
--     haya asistido; vale la fecha más tardía del paso por el grupo).
--   · La FICHA tiene que tener más de N años, siempre: una ficha nueva
--     todavía puede integrarse («aún hay esperanza»). Una ficha vieja sin
--     ningún registro entra (8.569 de las 9.078 sin registro al 2026-10-30).
--   · Quien SIRVE hoy en un puesto activo nunca entra.
--
-- Medido el 2026-10-30 (24.058 fichas activas): ≈ 14.260 entran; la consulta
-- tarda ~1,5 s, por eso va en SQL y no armada desde la app.

create or replace function public.miembros_sin_actividad(p_anios int default 3)
returns table (member_id uuid)
language sql
stable
as $$
  with corte as (select now() - make_interval(years => greatest(p_anios, 1)) as f),
  act as (
    select ck.member_id, max(ck.checked_in_at) as f
      from event_checkins ck where ck.member_id is not null group by 1
    union all
    select er.member_id, max(ev.starts_at)
      from event_registrations er join events ev on ev.id = er.event_id
     where er.member_id is not null group by 1
    union all
    select e.member_id,
           max(greatest(
             coalesce(e.completed_at, e.dropped_at, g.ends_at, g.starts_at, e.enrolled_at),
             coalesce(g.starts_at, e.enrolled_at)))
      from study_enrollments e left join study_groups g on g.id = e.group_id
     group by 1
  ),
  ultima as (select a.member_id, max(a.f) as f from act a group by 1)
  select m.id as member_id
    from members m
    cross join corte
    left join ultima u on u.member_id = m.id
   where m.created_at < corte.f
     and (u.f is null or u.f < corte.f)
     and not exists (select 1 from volunteers v where v.member_id = m.id and v.status = 'active')
$$;

revoke execute on function public.miembros_sin_actividad(int) from public, anon, authenticated;
grant  execute on function public.miembros_sin_actividad(int) to service_role;
alter  function public.miembros_sin_actividad(int) set search_path to 'public';
