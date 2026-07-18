-- QA 2026-07-17: limpieza de tablas/columnas sin uso confirmado.
--
-- · family_unlink_requests: sin write-path en la app (0 filas desde su
--   creación); solo la leía una alerta del dashboard que siempre daba 0.
-- · application_status_history: creada en la mig 062 pero nunca se implementó
--   el logging (0 filas, 0 referencias en código).
-- · study_groups.schedule: columna TEXT legacy del schema inicial; el código
--   usa schedule_days + schedule_time (0 valores no nulos, 0 referencias).
--
-- NO se toca payments.category_id: aunque la app nunca la escribe, el join de
-- lectura (category:payment_categories) y una vista SQL dependen de la FK.

drop table if exists family_unlink_requests;
drop table if exists application_status_history;
alter table study_groups drop column if exists schedule;
