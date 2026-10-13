-- REP-16 (corrección) · La serie no puede mostrar años que no han pasado.
--
-- LO QUE INTRODUJE HOY. La migración 20261012210000 expandió cada grupo a
-- todos los años que abarca, que era el arreglo correcto. Pero los grupos de
-- octubre terminan la primera semana de enero, así que la expansión llegó
-- hasta 2027 y el gráfico pintó un punto de 84 estudiantes en un año que no
-- ha empezado. Lo reportó Floriana a la hora de haberse desplegado.
--
-- Son estudiantes reales de grupos reales —Nivel 4 de Marco Acuña, Nivel 2 de
-- Johana Forero y nueve más, todos cerrando entre el 4 y el 12 de enero—,
-- pero ponerlos en 2027 convierte una proyección en un dato histórico. En un
-- gráfico de evolución eso se lee como «el otro año ya empezó flojo», que es
-- justo lo contrario de lo que dice el número.
--
-- La tabla nunca tuvo el problema porque se pide por año y nadie pide 2027.
-- El gráfico muestra TODOS los años de la serie, así que ahí sí sale.
--
-- El corte es el año en curso en hora de Costa Rica, no UTC: entre las 18:00
-- del 31 de diciembre y la medianoche, UTC ya está en el año siguiente y el
-- gráfico estrenaría un punto vacío seis horas antes de tiempo.

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
  cross join lateral generate_series(
    extract(year from coalesce(g.starts_at, g.created_at)::date)::int,
    extract(year from coalesce(g.closed_at, g.ends_at, g.starts_at, g.created_at)::date)::int
  ) as y(anio)
  where se.status not in ('cancelada', 'transferred', 'dropped')
    and m.first_name not ilike '%[prueba]%'
    and m.last_name  not ilike '%[prueba]%'
    -- Hasta el año en curso y ni uno más: lo que sigue es proyección.
    and y.anio <= extract(year from (now() at time zone 'America/Costa_Rica'))::int
  group by 1, 2, 3
$function$;

revoke execute on function public.report_estudios_series() from public, anon, authenticated;
grant  execute on function public.report_estudios_series() to service_role;
