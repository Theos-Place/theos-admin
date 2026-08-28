-- El revisor pasa a ser OPCIONAL en las funciones de aprobación.
--
-- Desde que el comprobante se acepta solo al subirlo, hay aprobaciones sin
-- revisor: nadie las miró. Antes el parámetro era obligatorio y el generador de
-- tipos lo marcaba como string no-nulo, así que el código tenía que mentirle al
-- compilador con un cast para pasar NULL. Con DEFAULT NULL el tipo generado
-- queda opcional y la intención queda escrita en la firma, no en un comentario.
--
-- reviewed_by = NULL es el registro honesto de "no lo revisó nadie". Poner ahí a
-- la propia persona que subió el comprobante sería peor que dejarlo vacío.
CREATE OR REPLACE FUNCTION public.approve_payment(p_payment_id uuid, p_reviewer uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  ELSIF v_concept = 'prematrimonial' THEN
    UPDATE prematrimonial_requests SET status = 'pendiente', reviewed_by = p_reviewer
    WHERE payment_id = p_payment_id AND status = 'pago_en_revision';
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.revert_payment_approval(
  p_payment_id uuid, p_reviewer uuid DEFAULT NULL, p_reason text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_concept text;
  v_enrollment uuid;
  v_event_registration uuid;
BEGIN
  UPDATE payments
  SET review_status = 'rechazado', status = 'pending',
      rejection_reason = p_reason, reviewed_by = p_reviewer,
      reviewed_at = now(), paid_at = NULL
  WHERE id = p_payment_id AND review_status = 'aprobado'
  RETURNING concept, enrollment_id, event_registration_id
    INTO v_concept, v_enrollment, v_event_registration;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_concept IN ('matricula', 'folletos') AND v_enrollment IS NOT NULL THEN
    UPDATE study_enrollments SET status = 'pendiente_de_pago'
    WHERE id = v_enrollment AND status = 'enrolled';
  ELSIF v_concept = 'evento' AND v_event_registration IS NOT NULL THEN
    UPDATE event_registrations SET payment_status = 'pending'
    WHERE id = v_event_registration AND payment_status = 'paid';
  ELSIF v_concept = 'prematrimonial' THEN
    UPDATE prematrimonial_requests SET status = 'pago_en_revision'
    WHERE payment_id = p_payment_id AND status = 'pendiente';
  END IF;
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public.revert_payment_approval(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revert_payment_approval(uuid, uuid, text) TO service_role;
