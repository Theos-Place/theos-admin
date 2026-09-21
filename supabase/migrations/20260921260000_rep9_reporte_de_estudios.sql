-- REP-9 · El reporte de estudios.
--
-- "ESTUDIANTE DEL AÑO" = alguien matriculado en un grupo que estuvo EN CURSO
-- ese año, no en un grupo creado ese año. Un grupo que arranca en noviembre y
-- cierra en febrero tiene estudiantes en los dos años, y contarlos solo en el
-- primero escondería medio cuatrimestre.
--
-- Se excluyen las matrículas que ya no son: canceladas, transferidas y las que
-- la persona dejó. Y los datos [prueba].
--
-- Devuelve UNA FILA POR (plan, persona): los conteos, la des-duplicación y los
-- promedios se hacen en TypeScript, donde están las reglas y los tests. Acá
-- vive el dato.
create or replace function public.report_estudios_del_anio(p_anio integer)
returns table (
  plan_code text,
  plan_nombre text,
  grupo_id uuid,
  grupo_estado text,
  member_id uuid,
  matricula_estado text,
  birth_date date,
  gender text,
  inicio_del_grupo date,
  leader_id uuid,
  co_leader_id uuid
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sp.code, 'SIN-PLAN'),
         coalesce(sp.name, 'Sin plan'),
         g.id,
         g.status,
         se.member_id,
         se.status,
         m.birth_date,
         m.gender,
         coalesce(g.starts_at, g.created_at)::date,
         g.leader_id,
         g.co_leader_id
  from study_groups g
  left join study_plans sp on sp.id = g.plan_id
  join study_enrollments se on se.group_id = g.id
  join members m on m.id = se.member_id
  where
    -- El grupo se cruza con el año: empezó antes de que terminara y terminó
    -- después de que empezara.
    coalesce(g.starts_at, g.created_at)::date <= make_date(p_anio, 12, 31)
    and coalesce(g.closed_at, g.ends_at, g.starts_at, g.created_at)::date >= make_date(p_anio, 1, 1)
    and se.status not in ('cancelada', 'transferred', 'dropped')
    and m.first_name not ilike '%[prueba]%'
    and m.last_name  not ilike '%[prueba]%'
$$;

-- La evolución año a año, agregada: estudiantes distintos por año y por plan.
create or replace function public.report_estudios_series()
returns table (anio integer, plan_code text, plan_nombre text, estudiantes bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select extract(year from coalesce(g.starts_at, g.created_at))::int,
         coalesce(sp.code, 'SIN-PLAN'),
         coalesce(sp.name, 'Sin plan'),
         count(distinct se.member_id)::bigint
  from study_groups g
  left join study_plans sp on sp.id = g.plan_id
  join study_enrollments se on se.group_id = g.id
  join members m on m.id = se.member_id
  where se.status not in ('cancelada', 'transferred', 'dropped')
    and m.first_name not ilike '%[prueba]%'
    and m.last_name  not ilike '%[prueba]%'
  group by 1, 2, 3
$$;

revoke execute on function public.report_estudios_del_anio(integer) from public, anon, authenticated;
revoke execute on function public.report_estudios_series() from public, anon, authenticated;
grant  execute on function public.report_estudios_del_anio(integer) to service_role;
grant  execute on function public.report_estudios_series() to service_role;
