-- REP-9 · El reporte de estudios trae el bloque de cada grupo.
--
-- OJO con el hueco, que es grande: de los 255 grupos en curso en 2026, solo 101
-- tienen bloque. Los otros 199 son históricos migrados y grupos creados fuera
-- del sistema de bloques. Por eso la pantalla ofrece "Sin bloque" como una
-- opción más y con su conteo: filtrar por bloque escondería la mayoría sin
-- decirlo.
drop function if exists public.report_estudios_del_anio(integer);

create function public.report_estudios_del_anio(p_anio integer)
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
  co_leader_id uuid,
  bloque text
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
         g.co_leader_id,
         b.nombre
  from study_groups g
  left join study_plans sp on sp.id = g.plan_id
  left join capacitacion_bloques b on b.id = g.bloque_id
  join study_enrollments se on se.group_id = g.id
  join members m on m.id = se.member_id
  where coalesce(g.starts_at, g.created_at)::date <= make_date(p_anio, 12, 31)
    and coalesce(g.closed_at, g.ends_at, g.starts_at, g.created_at)::date >= make_date(p_anio, 1, 1)
    and se.status not in ('cancelada', 'transferred', 'dropped')
    and m.first_name not ilike '%[prueba]%'
    and m.last_name  not ilike '%[prueba]%'
$$;

revoke execute on function public.report_estudios_del_anio(integer) from public, anon, authenticated;
grant  execute on function public.report_estudios_del_anio(integer) to service_role;
