-- REP-16 · El gráfico de estudios y la tabla contaban años distintos.
--
-- MEDIDO en 2026: KPI 1.191 · tabla 1.823 · gráfico 1.897.
--
-- El KPI y la tabla reconcilian bien y siempre lo hicieron: 1.191 son
-- PERSONAS únicas y 1.823 es persona × tipo de estudio (quien lleva dos
-- estudios cuenta en los dos). Eso es intencional y la pantalla lo dice.
--
-- El gráfico no. Tenía DOS problemas, los dos por la misma línea:
--
--   extract(year from coalesce(g.starts_at, g.created_at))
--
-- 1. Contaba el año en que el grupo ARRANCÓ, no los años en que estuvo EN
--    CURSO. La definición correcta está documentada en lib/reports/estudios.ts
--    desde que se escribió el reporte: «alguien matriculado en un grupo que
--    estuvo en curso ese año, NO en uno creado ese año. Un grupo que arranca
--    en noviembre y cierra en febrero tiene estudiantes en los dos». La tabla
--    la respeta; la serie se quedó con la definición vieja.
--
-- 2. Peor: cuando `starts_at` es NULL cae a `created_at`, que para los grupos
--    del import histórico es la fecha del IMPORT (18-jul-2026). Grupos
--    TRANSFORMADOS cerrados el 22-dic-2015 estaban contados como estudiantes
--    de 2026. De ahí salían TRANS (30), UFA (11), PLANDANIEL (9) y EVA (6):
--    56 estudiantes de hace diez años metidos en el año en curso.
--
-- EL ARREGLO. La serie usa el MISMO inicio, el MISMO fin y el MISMO universo
-- que report_estudios_del_anio, y expande el grupo a todos los años que
-- abarca. Un grupo cuyo año de inicio quede DESPUÉS del de cierre —los
-- históricos sin fecha— no genera ninguna fila, que es exactamente lo que la
-- tabla ya hacía con ellos: no aparecen en ningún año, porque su fecha es
-- inconsistente y meterlos en uno inventado es lo que causó esto.
--
-- Con esto la suma de la tabla de un año es IGUAL al punto del gráfico de ese
-- año, que es la propiedad que faltaba y la que el test fija.

create or replace function public.report_estudios_series()
returns table(anio integer, plan_code text, plan_nombre text, estudiantes bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select y.anio::int,
         coalesce(sp.code, 'SIN-PLAN'),
         coalesce(sp.name, 'Sin plan'),
         count(distinct se.member_id)::bigint
  from study_groups g
  left join study_plans sp on sp.id = g.plan_id
  join study_enrollments se on se.group_id = g.id
  join members m on m.id = se.member_id
  -- Los mismos dos extremos que usa report_estudios_del_anio, en el mismo
  -- orden de coalesce. Si se tocan allá, se tocan acá.
  cross join lateral generate_series(
    extract(year from coalesce(g.starts_at, g.created_at)::date)::int,
    extract(year from coalesce(g.closed_at, g.ends_at, g.starts_at, g.created_at)::date)::int
  ) as y(anio)
  where se.status not in ('cancelada', 'transferred', 'dropped')
    and m.first_name not ilike '%[prueba]%'
    and m.last_name  not ilike '%[prueba]%'
  group by 1, 2, 3
$function$;

revoke execute on function public.report_estudios_series() from public, anon, authenticated;
grant  execute on function public.report_estudios_series() to service_role;
