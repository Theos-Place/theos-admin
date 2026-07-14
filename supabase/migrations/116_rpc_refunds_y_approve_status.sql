-- Auditoría BE 2026-07-13, hallazgos A2 y A5.

-- ── A5: approve_payment exige status='pending' ─────────────────────────────
-- Antes solo condicionaba review_status: podía re-marcar 'paid' un pago
-- refunded (con la devolución completed vigente).
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
  WHERE id = p_payment_id
    AND review_status = 'en_revision'
    AND status = 'pending'
  RETURNING concept, enrollment_id INTO v_concept, v_enrollment;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_concept = 'matricula' AND v_enrollment IS NOT NULL THEN
    UPDATE study_enrollments SET status = 'enrolled'
    WHERE id = v_enrollment AND status = 'pendiente_de_pago';
  END IF;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION approve_payment(uuid, uuid) FROM public, anon, authenticated;

-- ── A2a: create_refund transaccional con lock ──────────────────────────────
-- Antes: check-then-insert sin lock (dos POST concurrentes → sobre-devolución)
-- y aceptaba refunds de pagos pending/failed. Devuelve código de resultado.
CREATE OR REPLACE FUNCTION create_refund(
  p_payment_id uuid,
  p_member_id uuid,
  p_amount numeric,
  p_method text,
  p_reason text,
  p_sinpe_pending boolean,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pay payments%ROWTYPE;
  v_refunded numeric;
  v_id uuid;
BEGIN
  -- Lock del pago: serializa refunds concurrentes del mismo pago.
  SELECT * INTO v_pay FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'not_found'); END IF;
  -- Solo pagos efectivamente cobrados admiten devolución.
  IF v_pay.status NOT IN ('paid', 'partial_refund') THEN
    RETURN jsonb_build_object('code', 'not_refundable', 'status', v_pay.status);
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('code', 'invalid_amount');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_refunded
  FROM refunds
  WHERE payment_id = p_payment_id AND status IN ('pending', 'processing', 'completed');
  IF p_amount + v_refunded > v_pay.amount THEN
    RETURN jsonb_build_object('code', 'exceeds', 'max', v_pay.amount - v_refunded);
  END IF;

  INSERT INTO refunds (payment_id, member_id, amount, method, reason, sinpe_pending, notes)
  VALUES (p_payment_id, coalesce(p_member_id, v_pay.member_id), p_amount, p_method, p_reason, coalesce(p_sinpe_pending, false), p_notes)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('code', 'ok', 'id', v_id);
END $$;
REVOKE EXECUTE ON FUNCTION create_refund(uuid, uuid, numeric, text, text, boolean, text) FROM public, anon, authenticated;

-- ── A2b: process_refund transaccional ──────────────────────────────────────
-- Antes: dos updates sueltos (refund completed podía quedar con el pago aún
-- paid) y completar una devolución PARCIAL marcaba el pago 'refunded' entero.
-- Ahora el estado del pago se deriva del total devuelto EN LA MISMA
-- transacción: refunded si cubre el monto, partial_refund si no.
CREATE OR REPLACE FUNCTION process_refund(
  p_refund_id uuid,
  p_status text,
  p_processed_at timestamptz DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref refunds%ROWTYPE;
  v_pay payments%ROWTYPE;
  v_completed numeric;
BEGIN
  SELECT * INTO v_ref FROM refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'not_found'); END IF;

  -- Máquina de estados: completed/rejected son terminales.
  IF NOT (
    (v_ref.status = 'pending' AND p_status IN ('processing', 'completed', 'rejected')) OR
    (v_ref.status = 'processing' AND p_status IN ('completed', 'rejected'))
  ) THEN
    RETURN jsonb_build_object('code', 'invalid_transition', 'from', v_ref.status);
  END IF;

  UPDATE refunds SET
    status = p_status,
    processed_at = CASE WHEN p_status IN ('completed', 'rejected')
                        THEN coalesce(p_processed_at, now()) ELSE processed_at END,
    notes = CASE WHEN p_note IS NOT NULL AND trim(p_note) <> ''
                 THEN nullif(concat_ws(E'\n', notes, trim(p_note)), '') ELSE notes END
  WHERE id = p_refund_id;

  IF p_status = 'completed' THEN
    SELECT * INTO v_pay FROM payments WHERE id = v_ref.payment_id FOR UPDATE;
    SELECT coalesce(sum(amount), 0) INTO v_completed
    FROM refunds WHERE payment_id = v_ref.payment_id AND status = 'completed';
    UPDATE payments
    SET status = CASE WHEN v_completed >= v_pay.amount THEN 'refunded' ELSE 'partial_refund' END
    WHERE id = v_ref.payment_id;
  END IF;

  RETURN jsonb_build_object('code', 'ok');
END $$;
REVOKE EXECUTE ON FUNCTION process_refund(uuid, text, timestamptz, text) FROM public, anon, authenticated;

-- Cosmético del informe: refunds.method no admitía 'comprobante' (los pagos de
-- matrícula usan ese método) — devolver uno daba 500 por CHECK violation.
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_method_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_method_check
  CHECK (method IN ('card', 'sinpe', 'scholarship', 'cash', 'comprobante'));
