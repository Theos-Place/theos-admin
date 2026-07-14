-- A17 (auditoría de rendimiento 2026-07-13): refresh_member_sedes tardaba
-- ~4.4 s por corrida (2ª query más cara de producción). Causa: el planner
-- inlineaba el CTE y evaluaba charla_sede_code(title) — una cadena de 14
-- LIKEs — POR CHECK-IN (~145k veces) en vez de por evento (~2.8k).
-- Con CTEs MATERIALIZED la función se evalúa una vez por evento: 480 ms
-- medidos (9× más rápido), mismo resultado.
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
  -- Últimos 6 meses: más check-ins gana; empate → check-in más reciente.
  recent AS (
    SELECT DISTINCT ON (member_id) member_id, code
    FROM (
      SELECT member_id, code, COUNT(*) AS n, MAX(checked_in_at) AS last_at
      FROM charla_checkins
      WHERE checked_in_at >= NOW() - INTERVAL '6 months'
      GROUP BY member_id, code
    ) x
    ORDER BY member_id, n DESC, last_at DESC
  ),
  -- Sin charlas recientes → se busca hacia atrás: la última charla histórica.
  fallback AS (
    SELECT DISTINCT ON (member_id) member_id, code
    FROM charla_checkins
    ORDER BY member_id, checked_in_at DESC
  ),
  chosen AS (
    SELECT f.member_id, COALESCE(r.code, f.code) AS code
    FROM fallback f
    LEFT JOIN recent r USING (member_id)
  )
  UPDATE members m
  SET sede_id = s.id
  FROM chosen ch
  JOIN sedes s ON s.code = ch.code
  WHERE m.id = ch.member_id
    AND m.sede_id IS DISTINCT FROM s.id;
$$;
