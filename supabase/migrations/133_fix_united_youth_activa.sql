-- United Youth estaba marcada como histórica (is_active=false,
-- is_historical=true) pero sigue teniendo charlas activas (última el
-- 2026-06-14, 9 charlas en los últimos 90 días). Se reclasifica como activa
-- — mismo caso que Home y Heredia Youth (migración 128), confirmado por el
-- usuario el 2026-07-17.
update sedes set is_active = true, is_historical = false
where code = 'united-youth';
