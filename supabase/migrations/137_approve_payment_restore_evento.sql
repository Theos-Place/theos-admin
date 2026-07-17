-- Fase 2 (cobro en sitio de eventos): la migración 131 reescribió
-- approve_payment y PERDIÓ dos cosas de la versión 121:
--   1. La rama de eventos (event_registrations: pending → paid). Sin ella,
--      aprobar un pago de evento dejaba la inscripción en 'pending'.
--   2. El guard `status = 'pending'` en el WHERE (hallazgo A5 de la 116):
--      sin él se podía re-marcar 'paid' un pago ya refunded.
-- Se restauran ambos, conservando la rama 'folletos' que sí agregó la 131.
CREATE OR REPLACE FUNCTION approve_payment(p_payment_id uuid, p_reviewer uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_concept text;
  v_enrollment uuid;
  v_event_registration uuid;
BEGIN
  UPDATE payments
  SET review_status = 'aprobado', status = 'paid',
      reviewed_by = p_reviewer, reviewed_at = now(), paid_at = now()
  WHERE id = p_payment_id AND review_status = 'en_revision' AND status = 'pending'
  RETURNING concept, enrollment_id, event_registration_id
    INTO v_concept, v_enrollment, v_event_registration;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_concept IN ('matricula', 'folletos') AND v_enrollment IS NOT NULL THEN
    UPDATE study_enrollments SET status = 'enrolled'
    WHERE id = v_enrollment AND status = 'pendiente_de_pago';
  ELSIF v_concept = 'evento' AND v_event_registration IS NOT NULL THEN
    UPDATE event_registrations SET payment_status = 'paid'
    WHERE id = v_event_registration AND payment_status = 'pending';
  END IF;
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION approve_payment(uuid, uuid) FROM public, anon, authenticated;
