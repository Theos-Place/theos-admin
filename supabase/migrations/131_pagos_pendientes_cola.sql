-- Cola de pagos pendientes (Tanda B): approve_payment también debe activar la
-- matrícula cuando el pago es de concepto 'folletos' (reubicación con folleto,
-- Tanda A) — antes solo lo hacía para 'matricula'. Misma transacción, mismo
-- guard (pendiente_de_pago → enrolled).
CREATE OR REPLACE FUNCTION approve_payment(p_payment_id uuid, p_reviewer uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_concept text;
  v_enrollment uuid;
BEGIN
  UPDATE payments
  SET review_status = 'aprobado', status = 'paid',
      reviewed_by = p_reviewer, reviewed_at = now(), paid_at = now()
  WHERE id = p_payment_id AND review_status = 'en_revision'
  RETURNING concept, enrollment_id INTO v_concept, v_enrollment;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_concept IN ('matricula', 'folletos') AND v_enrollment IS NOT NULL THEN
    UPDATE study_enrollments SET status = 'enrolled'
    WHERE id = v_enrollment AND status = 'pendiente_de_pago';
  END IF;
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION approve_payment(uuid, uuid) FROM public, anon, authenticated;
