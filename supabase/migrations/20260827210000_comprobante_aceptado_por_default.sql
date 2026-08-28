-- Cambio de regla (2026-08-27): un pago con comprobante se da por BUENO al
-- subirlo. Ya no espera en una cola a que finanzas lo apruebe uno por uno.
--
-- Antes: subir comprobante → review_status 'en_revision' → alguien aprueba →
-- recién ahí la matrícula/inscripción se activa. En la práctica eso dejaba a la
-- gente esperando por algo que casi siempre se aprueba igual.
--
-- Ahora la aceptación es inmediata y lo que queda es la posibilidad de
-- REVERTIRLA en casos especiales. Para eso hace falta que se pueda rechazar un
-- pago YA APROBADO, que es lo que agrega este RPC: es el inverso de
-- approve_payment y deshace lo que aquel activó.
--
-- Sin esto el cambio sería una puerta de una sola vía: todo se acepta y nada se
-- puede devolver.
CREATE OR REPLACE FUNCTION public.revert_payment_approval(
  p_payment_id uuid,
  p_reviewer uuid,
  p_reason text
) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  -- Deshace EXACTAMENTE lo que activó approve_payment, y solo si sigue en el
  -- estado que aquel dejó: si alguien ya avanzó a la persona por otro camino,
  -- no se le pisa.
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

COMMENT ON FUNCTION public.revert_payment_approval IS
  'Inverso de approve_payment: devuelve un pago aprobado a rechazado y deshace la activación de la matrícula/inscripción. Para los casos especiales del régimen "el comprobante se acepta por default".';
