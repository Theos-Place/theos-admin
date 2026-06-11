-- 042: unifica lista de espera y reubicaciones dentro de study_requests.
-- Las páginas /estudios/lista-de-espera y /estudios/reubicaciones se eliminan;
-- todo se gestiona en /estudios/solicitudes.
--
-- Las tablas viejas (study_waitlist, relocation_requests) NO se borran: quedan
-- como respaldo histórico de la migración de datos. Nada las escribe ya.

-- Lista de espera → solicitudes 'join_group' abiertas.
-- N1 → plan con code 'N1'; campañas → plan con code = campaign_code.
-- Las preferencias de zona/horario se conservan en proposed_location/schedule.
INSERT INTO study_requests
  (member_id, request_type, plan_id, proposed_location, proposed_schedule, reason, status, created_at)
SELECT
  w.member_id,
  'join_group',
  (SELECT p.id FROM study_plans p WHERE p.code = COALESCE(w.campaign_code, 'N1') LIMIT 1),
  w.zone_preference,
  w.schedule_preference,
  'Migrado de la lista de espera'
    || CASE WHEN w.type = 'campaign'
         THEN ' (campaña ' || COALESCE(w.campaign_code, 'sin código') || ')'
         ELSE ' (Nivel 1)' END
    || COALESCE('. Zona: ' || NULLIF(w.zone_preference, ''), '')
    || COALESCE('. Horario: ' || NULLIF(w.schedule_preference, ''), ''),
  'open',
  COALESCE(w.requested_at, w.created_at, NOW())
FROM study_waitlist w;

-- Reubicaciones → solicitudes 'relocation'. pending → open, resolved → resolved.
INSERT INTO study_requests
  (member_id, request_type, current_group_id, reason, status, reviewed_at, created_at)
SELECT
  r.member_id,
  'relocation',
  r.from_group_id,
  COALESCE(NULLIF(r.reason, ''), 'Migrado del módulo de reubicaciones'),
  CASE r.status WHEN 'resolved' THEN 'resolved' ELSE 'open' END,
  CASE r.status WHEN 'resolved' THEN COALESCE(r.requested_at, r.created_at) END,
  COALESCE(r.requested_at, r.created_at, NOW())
FROM relocation_requests r;
