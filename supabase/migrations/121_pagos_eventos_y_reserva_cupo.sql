-- Extiende el sistema de pago por comprobante (ya usado en matrícula) a
-- inscripción de eventos. Reserva de cupo mientras el pago está en revisión
-- (matrícula y eventos), y expiración automática tras rechazo sin resubir.

-- ── Concepto 'evento' + referencia polimórfica en payments ──────────────────
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_concept_check;
ALTER TABLE payments ADD CONSTRAINT payments_concept_check
  CHECK (concept IS NULL OR concept = ANY (ARRAY['matricula','folletos','evento']::text[]));

ALTER TABLE payments ADD COLUMN IF NOT EXISTS event_registration_id uuid
  REFERENCES event_registrations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_event_registration ON payments(event_registration_id);

-- Un solo comprobante en revisión por inscripción a evento (espejo del
-- payments_comprobante_en_revision_uniq de matrícula, migración 118).
CREATE UNIQUE INDEX IF NOT EXISTS payments_comprobante_evento_en_revision_uniq
  ON payments (event_registration_id)
  WHERE review_status = 'en_revision' AND concept = 'evento' AND event_registration_id IS NOT NULL;

-- ── Estados de "cupo liberado" ───────────────────────────────────────────────
ALTER TABLE event_registrations DROP CONSTRAINT IF EXISTS event_registrations_payment_status_check;
ALTER TABLE event_registrations ADD CONSTRAINT event_registrations_payment_status_check
  CHECK (payment_status = ANY (ARRAY['pending','paid','exempted','expired']::text[]));

ALTER TABLE study_enrollments DROP CONSTRAINT IF EXISTS study_enrollments_status_check;
ALTER TABLE study_enrollments ADD CONSTRAINT study_enrollments_status_check
  CHECK (status = ANY (ARRAY['enrolled','waitlist','completed','dropped','transferred','pendiente_de_pago','expirada']::text[]));
-- 'expirada' es DISTINTO de 'dropped' (retiro voluntario, otra semántica en reportes).

-- ── register_for_event: inscripción transaccional sin condición de carrera ──
-- Lockea la fila del evento, cuenta ocupación real (pending+paid+exempted,
-- nunca 'expired') contra max_capacity, inserta con payment_status='pending'.
CREATE OR REPLACE FUNCTION register_for_event(p_event_id uuid, p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max_capacity int;
  v_occupied int;
  v_registration_id uuid;
BEGIN
  SELECT max_capacity INTO v_max_capacity FROM events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'event_not_found'); END IF;

  IF v_max_capacity IS NOT NULL AND v_max_capacity > 0 THEN
    SELECT count(*) INTO v_occupied FROM event_registrations
    WHERE event_id = p_event_id AND payment_status IN ('pending','paid','exempted');
    IF v_occupied >= v_max_capacity THEN RETURN jsonb_build_object('code', 'event_full'); END IF;
  END IF;

  INSERT INTO event_registrations (event_id, member_id, payment_status)
  VALUES (p_event_id, p_member_id, 'pending')
  ON CONFLICT (event_id, member_id) DO NOTHING
  RETURNING id INTO v_registration_id;
  IF v_registration_id IS NULL THEN RETURN jsonb_build_object('code', 'already_registered'); END IF;

  RETURN jsonb_build_object('code', 'ok', 'id', v_registration_id);
END $$;
REVOKE EXECUTE ON FUNCTION register_for_event(uuid, uuid) FROM public, anon, authenticated;

-- ── approve_payment: rama para eventos ───────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_payment(p_payment_id uuid, p_reviewer uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_concept text; v_enrollment uuid; v_event_registration uuid;
BEGIN
  UPDATE payments
  SET review_status = 'aprobado', status = 'paid',
      reviewed_by = p_reviewer, reviewed_at = now(), paid_at = now()
  WHERE id = p_payment_id AND review_status = 'en_revision' AND status = 'pending'
  RETURNING concept, enrollment_id, event_registration_id INTO v_concept, v_enrollment, v_event_registration;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_concept = 'matricula' AND v_enrollment IS NOT NULL THEN
    UPDATE study_enrollments SET status = 'enrolled' WHERE id = v_enrollment AND status = 'pendiente_de_pago';
  ELSIF v_concept = 'evento' AND v_event_registration IS NOT NULL THEN
    UPDATE event_registrations SET payment_status = 'paid' WHERE id = v_event_registration AND payment_status = 'pending';
  END IF;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION approve_payment(uuid, uuid) FROM public, anon, authenticated;
