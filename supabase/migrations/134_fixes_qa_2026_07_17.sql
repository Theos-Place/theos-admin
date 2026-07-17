-- Fixes de la auditoría QA 2026-07-17 (docs/qa-2026-07-17.md).

-- ── 1. active_attendance_member_ids: orden estable para paginar ─────────────
-- PostgREST corta la respuesta del RPC en db-max-rows (1000) y hoy hay >1000
-- miembros con asistencia activa (verificado: 1,052) — el cliente pasa a
-- paginar con .range(), lo que exige un ORDER BY estable.
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
  ORDER BY c.member_id
$$;
REVOKE EXECUTE ON FUNCTION active_attendance_member_ids(timestamptz, int, timestamptz) FROM public, anon, authenticated;

-- ── 9. Saldo de vacaciones: incremento atómico ──────────────────────────────
-- vacation_days_used se actualizaba con read-then-write en la app: dos
-- aprobaciones casi simultáneas del mismo empleado perdían una (lost update).
CREATE OR REPLACE FUNCTION increment_vacation_days_used(p_employee_id uuid, p_delta int)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE employees
  SET vacation_days_used = GREATEST(0, COALESCE(vacation_days_used, 0) + p_delta)
  WHERE id = p_employee_id
$$;
REVOKE EXECUTE ON FUNCTION increment_vacation_days_used(uuid, int) FROM public, anon, authenticated;
