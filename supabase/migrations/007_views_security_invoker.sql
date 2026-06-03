-- 007: Forzar security_invoker en las vistas de reportes.
-- Por defecto una vista corre con los permisos de su owner (postgres) y salta
-- el RLS de quien consulta. Con security_invoker = on la vista respeta las
-- políticas RLS del usuario que hace el query. Resuelve el lint 0010.

ALTER VIEW vw_asistencia_semanal SET (security_invoker = on);
ALTER VIEW vw_asistencia_mensual SET (security_invoker = on);
ALTER VIEW vw_asistentes         SET (security_invoker = on);
ALTER VIEW vw_resumen_financiero SET (security_invoker = on);
