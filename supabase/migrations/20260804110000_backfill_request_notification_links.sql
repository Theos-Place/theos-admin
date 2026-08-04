-- Bug 2026-08-04: las notificaciones de solicitudes creadas antes de que el
-- link llevara ?tab= apuntan a /estudios/solicitudes?request=<id> (o al pelo,
-- sin request). Al abrirlas caían en el tab por defecto (prematrimonial) y la
-- solicitud enlazada no se abría.
--
-- El código ya genera el link canónico (requestDeepLink). Esto repara las que
-- ya están en la campana de la gente, tomando el tipo de la solicitud real.

-- 1. Links con ?request=<id> y sin ?tab= → se les antepone el tab del tipo.
UPDATE internal_notifications n
SET link = '/estudios/solicitudes?tab=' || r.request_type || '&request=' || r.id
FROM study_requests r
WHERE n.link = '/estudios/solicitudes?request=' || r.id;

-- 2. Notificaciones de asignación sin ningún parámetro: no se puede saber a
--    cuál solicitud apuntaban, pero al menos que abran el tab de gestión
--    (reubicaciones) y no la cola de prematrimonial.
UPDATE internal_notifications
SET link = '/estudios/solicitudes?tab=relocation'
WHERE type = 'study_request_assigned'
  AND link = '/estudios/solicitudes';
