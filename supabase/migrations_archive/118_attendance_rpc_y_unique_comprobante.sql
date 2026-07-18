-- Auditoría BE 2026-07-13, hallazgos A16 y A12.

-- ── A16: asistencia activa agregada en SQL ──────────────────────────────────
-- getActiveAttendanceMemberIds era LA query más cara de producción: 2,436
-- llamadas × 95 ms paginando ~19k check-ins en ~19 round trips. Este agregado
-- resuelve lo mismo en ~37 ms y un solo round trip (medido).
-- Dos modos, idénticos a la lógica TS:
--   · p_min_count NOT NULL → conteo: >= N check-ins de charla en la ventana.
--   · p_min_count NULL     → cobertura: >= 1 check-in en CADA mes de p_months.
-- El mes se calcula igual que el TS actual (slice UTC del timestamp) para no
-- cambiar semántica; si algún día se corrige a hora CR, cambiar aquí Y en
-- lastCompleteMonthsKeys a la vez.
CREATE OR REPLACE FUNCTION active_attendance_member_ids(
  p_oldest timestamptz,
  p_months text[],
  p_min_count int DEFAULT NULL
) RETURNS TABLE(member_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.member_id
  FROM event_checkins c
  JOIN events e ON e.id = c.event_id AND e.event_type = 'charla'
  WHERE c.member_id IS NOT NULL
    AND c.checked_in_at >= p_oldest
  GROUP BY c.member_id
  HAVING (p_min_count IS NOT NULL AND count(*) >= p_min_count)
      OR (p_min_count IS NULL AND
          array_agg(DISTINCT to_char(c.checked_in_at AT TIME ZONE 'UTC', 'YYYY-MM')) @> p_months)
$$;
REVOKE EXECUTE ON FUNCTION active_attendance_member_ids(timestamptz, text[], int) FROM public, anon, authenticated;

-- ── A12a: un solo comprobante en revisión por matrícula ─────────────────────
-- El doble submit (doble clic / dos pestañas) podía crear dos pagos
-- 'en_revision' aprobables ambos → ingreso contable duplicado. El guard de la
-- app era check-then-insert; este índice lo hace imposible a nivel BD.
CREATE UNIQUE INDEX IF NOT EXISTS payments_comprobante_en_revision_uniq
  ON payments (enrollment_id)
  WHERE review_status = 'en_revision' AND concept = 'matricula' AND enrollment_id IS NOT NULL;
