-- 059: Stats del resumen de estudios en SQL (no client-side sobre toda la tabla).
-- Agrupa grupos por estado y categoría de plan, y suma las inscripciones del
-- estado relevante: 'enrolled' para grupos en curso (cursan hoy) y 'completed'
-- para finalizados (los que pasaron por el grupo).
--
-- Categorías por study_plans.level:
--   niveles        = N1–N4
--   capacitaciones = etapa_inicial + etapa_intermedia
--   (campanas quedan fuera de ambos boxes)
--
-- count(DISTINCT g.id) evita que el JOIN con inscripciones infle el conteo de
-- grupos. La suma de estudiantes usa el conteo de inscripciones del estado.

CREATE OR REPLACE FUNCTION study_dashboard_stats()
RETURNS TABLE (estado text, categoria text, grupos bigint, estudiantes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    g.status::text AS estado,
    CASE
      WHEN p.level = 'niveles' THEN 'niveles'
      WHEN p.level IN ('etapa_inicial', 'etapa_intermedia') THEN 'capacitaciones'
      ELSE 'otros'
    END AS categoria,
    count(DISTINCT g.id) AS grupos,
    count(e.member_id) FILTER (
      WHERE (g.status = 'en_curso'   AND e.status = 'enrolled')
         OR (g.status = 'finalizado' AND e.status = 'completed')
    ) AS estudiantes
  FROM study_groups g
  JOIN study_plans p ON p.id = g.plan_id
  LEFT JOIN study_enrollments e ON e.group_id = g.id
  WHERE g.status IN ('en_curso', 'finalizado')
  GROUP BY 1, 2;
$$;
