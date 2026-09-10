-- REP-2 · El agregado de charlas, ahora con el corte asistente/servidor.
--
-- El desglose POR SEDE Y POR SEMANA ya existía: la función agrupa por
-- (año, título, semana, mes) y el título es la sede. Lo único que faltaba para
-- el detalle semanal es separar quién fue a asistir de quién fue a servir.
--
-- NO se toca la zona horaria del extract, aunque parezca sospechoso: medido el
-- 2026-09-10, de las 3.521 charlas NINGUNA cambia de semana ni de año al
-- interpretarla en hora de Costa Rica. Las charlas son de tarde-noche entre
-- martes y domingo, así que el corrimiento a UTC nunca cruza el domingo.
--
-- La columna nueva va al final y el nombre de la función no cambia: el reporte
-- viejo sigue leyendo lo mismo, solo que ahora con una fila por calidad.

-- Postgres no deja cambiar el tipo de retorno con CREATE OR REPLACE: hay que
-- soltarla y volverla a crear. Va dentro de la transacción de la migración, así
-- que no hay una ventana en que la función no exista.
DROP FUNCTION IF EXISTS "public"."report_charla_attendance"();

CREATE FUNCTION "public"."report_charla_attendance"()
RETURNS TABLE("yr" integer, "title" "text", "wk" integer, "mo" integer, "checkins" bigint, "calidad" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select extract(year  from e.starts_at)::int  as yr,
         coalesce(se.name, e.title)             as title,
         extract(week  from e.starts_at)::int  as wk,
         extract(month from e.starts_at)::int  as mo,
         count(ec.id)::bigint                    as checkins,
         -- Los históricos no tienen el dato (la columna es de 2026-09-10):
         -- cuentan como asistentes, que es el default de la columna.
         coalesce(ec.checked_in_as, 'asistente') as calidad
  from events e
  join event_checkins ec on ec.event_id = e.id
  left join sub_events se on se.id = ec.sub_event_id
  where e.event_type = 'charla'
    and e.starts_at is not null
  group by 1, 2, 3, 4, 6
$$;

COMMENT ON FUNCTION "public"."report_charla_attendance"() IS
  'Agregado de check-ins de charla por (año, título, semana ISO, mes, calidad) para el reporte de asistencia. La sede se deriva del título en la app (sedes-canonical). calidad = asistente | servidor.';

-- Los GRANT se van con el DROP: se vuelven a poner como estaban.
REVOKE ALL ON FUNCTION "public"."report_charla_attendance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_charla_attendance"() TO "service_role";
