-- Criterio de asistencia ÚNICO (general + estudios + matrícula): ≥ p_min_count
-- check-ins de charla en los últimos N meses (p_oldest) Y al menos uno de esos
-- check-ins dentro de los últimos p_recency_since días. Reemplaza el RPC de la
-- migración 118, que tenía dos modos separados (conteo puro / cobertura
-- mensual) sin noción de recencia — ninguno de los dos podía expresar el
-- criterio combinado nuevo.
DROP FUNCTION IF EXISTS active_attendance_member_ids(timestamptz, text[], int);

CREATE OR REPLACE FUNCTION active_attendance_member_ids(
  p_oldest timestamptz,
  p_min_count int,
  p_recency_since timestamptz
) RETURNS TABLE(member_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.member_id
  FROM event_checkins c
  JOIN events e ON e.id = c.event_id AND e.event_type = 'charla'
  WHERE c.member_id IS NOT NULL
    AND c.checked_in_at >= p_oldest
  GROUP BY c.member_id
  HAVING count(*) >= p_min_count
     AND max(c.checked_in_at) >= p_recency_since
$$;
REVOKE EXECUTE ON FUNCTION active_attendance_member_ids(timestamptz, int, timestamptz) FROM public, anon, authenticated;
