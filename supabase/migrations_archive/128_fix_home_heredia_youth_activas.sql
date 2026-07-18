-- Home y Heredia Youth estaban marcadas como históricas (is_active=false,
-- is_historical=true) pero siguen teniendo charlas activas (últimas el
-- 2026-06-11 y 2026-06-10 respectivamente, con 8 charlas cada una en los
-- últimos 90 días). Se reclasifican como activas.
update sedes set is_active = true, is_historical = false
where code in ('home', 'heredia-youth');
