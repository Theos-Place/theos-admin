-- 049: sede del miembro inferida de su asistencia a charlas.
-- Regla (confirmada por dirección): sede = la charla con MÁS check-ins en los
-- últimos 6 meses; empate → la más reciente. Si no tiene charlas en la ventana,
-- se busca hacia atrás: su última charla histórica. Cron diario (pg_cron).
--
-- members.sede_id estaba poblado solo en 77 de 22,561 miembros y province en 0:
-- la asistencia real es la única fuente de zona disponible. La inferencia
-- sobreescribe sede_id solo para miembros CON historial de charlas; quienes no
-- tienen check-ins conservan lo que tengan.

-- Sede nueva detectada en las charlas importadas.
INSERT INTO sedes (code, name, is_active)
VALUES ('life-este', 'Life Este', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Título de charla → code de sede. Orden importa: Pro Oeste/Theos Home van a
-- meridiano y Pro Este a antares antes de los matches genéricos.
CREATE OR REPLACE FUNCTION charla_sede_code(p_title TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN t LIKE '%pro oeste%' OR t LIKE '%meridiano%' OR t LIKE '%theos home%' THEN 'meridiano'
    WHEN t LIKE '%pro este%' OR t LIKE '%antares%' THEN 'antares'
    WHEN t LIKE '%life este%' THEN 'life-este'
    WHEN t LIKE '%alajuela%' THEN 'alajuela'
    WHEN t LIKE '%cartago%' THEN 'cartago'
    WHEN t LIKE '%guapiles%' OR t LIKE '%guápiles%' THEN 'guapiles'
    WHEN t LIKE '%liberia%' THEN 'liberia'
    WHEN t LIKE '%madrid%' THEN 'madrid'
    WHEN t LIKE '%pedregal%' THEN 'pedregal'
    WHEN t LIKE '%potrero%' THEN 'potrero'
    WHEN t LIKE '%perez zeledon%' OR t LIKE '%pérez zeledón%' THEN 'perez-zeledon'
    WHEN t LIKE '%heredia%' THEN 'heredia'
    WHEN t LIKE '%united%' THEN 'united'
    ELSE NULL
  END
  FROM (SELECT lower(p_title) AS t) sub;
$$;

CREATE OR REPLACE FUNCTION refresh_member_sedes()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  WITH charla_checkins AS (
    SELECT c.member_id, charla_sede_code(e.title) AS code, c.checked_in_at
    FROM event_checkins c
    JOIN events e ON e.id = c.event_id
    WHERE e.event_type = 'charla'
      AND c.member_id IS NOT NULL
      AND charla_sede_code(e.title) IS NOT NULL
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

-- Cron diario (6:45 UTC, después del refresh de donadores de las 6:30).
DO $$
BEGIN
  PERFORM cron.schedule('refresh-member-sedes', '45 6 * * *', 'SELECT refresh_member_sedes()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron no disponible (%) — programar refresh_member_sedes() manualmente', SQLERRM;
END;
$$;

-- Cálculo inicial.
SELECT refresh_member_sedes();
