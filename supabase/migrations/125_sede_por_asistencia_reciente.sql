-- Sede por asistencia: prioriza lo reciente en vez de la mayoría sobre TODO
-- el historial. Mismo algoritmo que src/lib/sede-attendance.ts (TS, usado por
-- perfil/export en vivo) — acá su espejo en SQL para el cron masivo que
-- mantiene members.sede_id/sede_case/sede_last_checkin (22k+ miembros: no es
-- viable recalcular en vivo por request, ver refresh_member_sedes original).
--
--  · Activo (asistió en los últimos 6 meses): sede = charla más asistida en
--    esos últimos 6 meses. Empate → check-in más reciente.
--  · Inactivo (sin asistencia en 6 meses): se toma su última asistencia y se
--    calcula la sede como la charla más asistida en los 6 meses PREVIOS a esa
--    fecha (su último período activo, no todo el historial).
--  · Sin asistencias nunca: sede_id/sede_case/sede_last_checkin = NULL.

ALTER TABLE members
  ADD COLUMN sede_case TEXT CHECK (sede_case IN ('activo', 'inactivo')),
  ADD COLUMN sede_last_checkin TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION refresh_member_sedes()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  WITH events_coded AS MATERIALIZED (
    SELECT e.id, charla_sede_code(e.title) AS code
    FROM events e
    WHERE e.event_type = 'charla' AND charla_sede_code(e.title) IS NOT NULL
  ),
  charla_checkins AS MATERIALIZED (
    SELECT c.member_id, ec.code, c.checked_in_at
    FROM event_checkins c
    JOIN events_coded ec ON ec.id = c.event_id
    WHERE c.member_id IS NOT NULL
  ),
  last_activity AS MATERIALIZED (
    SELECT member_id, MAX(checked_in_at) AS last_at
    FROM charla_checkins
    GROUP BY member_id
  ),
  -- Ventana de la mayoría por miembro: si activo, últimos 6 meses desde hoy;
  -- si no, los 6 meses previos a su última asistencia.
  in_window AS (
    SELECT cc.member_id, cc.code, cc.checked_in_at,
      (la.last_at >= NOW() - INTERVAL '6 months') AS is_active
    FROM charla_checkins cc
    JOIN last_activity la USING (member_id)
    WHERE
      (la.last_at >= NOW() - INTERVAL '6 months' AND cc.checked_in_at >= NOW() - INTERVAL '6 months')
      OR
      (la.last_at < NOW() - INTERVAL '6 months'
        AND cc.checked_in_at >= la.last_at - INTERVAL '6 months'
        AND cc.checked_in_at <= la.last_at)
  ),
  tallied AS (
    SELECT member_id, code, is_active, COUNT(*) AS n, MAX(checked_in_at) AS last_of_code
    FROM in_window
    GROUP BY member_id, code, is_active
  ),
  chosen AS (
    SELECT DISTINCT ON (member_id) member_id, code, is_active
    FROM tallied
    ORDER BY member_id, n DESC, last_of_code DESC
  )
  UPDATE members m
  SET sede_id = s.id,
      sede_case = CASE WHEN ch.is_active THEN 'activo' ELSE 'inactivo' END,
      sede_last_checkin = la.last_at
  FROM chosen ch
  JOIN sedes s ON s.code = ch.code
  JOIN last_activity la ON la.member_id = ch.member_id
  WHERE m.id = ch.member_id
    AND (m.sede_id IS DISTINCT FROM s.id
      OR m.sede_case IS DISTINCT FROM (CASE WHEN ch.is_active THEN 'activo' ELSE 'inactivo' END)
      OR m.sede_last_checkin IS DISTINCT FROM la.last_at);

  -- Limpia la sede de quien no tiene NINGÚN check-in de charla válido hoy
  -- (nunca asistió, o borraron sus check-ins) — "Sin sede asignada".
  UPDATE members m
  SET sede_id = NULL, sede_case = NULL, sede_last_checkin = NULL
  WHERE (m.sede_id IS NOT NULL OR m.sede_case IS NOT NULL OR m.sede_last_checkin IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM event_checkins c
      JOIN events e ON e.id = c.event_id
      WHERE e.event_type = 'charla' AND c.member_id = m.id AND charla_sede_code(e.title) IS NOT NULL
    );
$$;

SELECT refresh_member_sedes();
