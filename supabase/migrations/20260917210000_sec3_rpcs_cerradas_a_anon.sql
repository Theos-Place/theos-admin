-- SEC-3 · Dos funciones quedaban ejecutables SIN SESIÓN, y no era teórico.
--
-- Comprobado el 2026-09-17 contra producción, con la llave pública que va en el
-- bundle del navegador y nada más:
--
--   POST /rest/v1/rpc/report_charla_attendance   → 200, el agregado de
--       asistencia de TODA la organización, año por año y charla por charla.
--   POST /rest/v1/rpc/member_por_external_id     → 200, el uuid de la ficha
--       que corresponde a un id de CCB, o sea que se pueden enumerar personas.
--
-- POR QUÉ PASABA. Una función en `public` nace con EXECUTE para PUBLIC, y
-- PostgREST publica todo lo de ese esquema en /rest/v1/rpc/. Las dos son
-- SECURITY DEFINER a propósito —`member_por_external_id` TIENE que ver fichas
-- inactivas para resolver las fusionadas (ver AGENTS.md), y el reporte agrega
-- por encima de RLS—, así que el permiso abierto las volvía públicas de verdad,
-- no solo nominalmente. Las otras 30 funciones SECURITY DEFINER del esquema ya
-- estaban cerradas: éstas dos se quedaron atrás.
--
-- LA SALIDA es revocar, no quitarles SECURITY DEFINER: lo necesitan. La app las
-- llama SIEMPRE desde el servidor con la llave de servicio —verificado:
-- `report_charla_attendance` va por `loadAggRows` con `createAdminClient`, y
-- `member_por_external_id` hoy no la llama nadie desde `src/` (ver DAT-9)—, así
-- que service_role basta.
revoke execute on function public.report_charla_attendance() from public, anon, authenticated;
revoke execute on function public.member_por_external_id(text) from public, anon, authenticated;
grant execute on function public.report_charla_attendance() to service_role;
grant execute on function public.member_por_external_id(text) to service_role;

-- `merge_no_copia()` sin search_path fijo. Es la única del esquema que faltaba.
-- No es SECURITY DEFINER, así que el riesgo es menor, pero la regla es que una
-- función no resuelva sus nombres contra el search_path de quien la llama:
-- basta una tabla `public.members` falsa antepuesta en el path para que la
-- función mire otra cosa.
alter function public.merge_no_copia() set search_path to 'public';
