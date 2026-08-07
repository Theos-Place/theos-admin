-- INT-3 · Los agregados de dinero dejan de sumar entre monedas.
--
-- EL PROBLEMA: donation_stats, payment_stats y dashboard_sums hacían sum(amount)
-- sin agrupar. Hoy no se nota porque todo está en colones (medido 2026-08-06:
-- 14,714 donaciones, 6 pagos, 4 becas, 41 planes, 3,372 eventos — todos CRC),
-- pero el día que entre el primer euro de Madrid el dashboard mostraría un
-- número sin significado.
--
-- LA REGLA: nunca se suman monedas distintas y nunca se convierte automáticamente.
-- Los totales pasan de un escalar a un objeto por moneda: {"CRC": 1250000, "EUR": 340}.
-- Una moneda sin movimientos NO aparece, así que mientras todo sea CRC el objeto
-- trae una sola clave y la UI muestra una sola línea.

-- ── donation_stats ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.donation_stats() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT json_build_object(
    'unique_donors',       (SELECT count(DISTINCT member_id) FROM donations WHERE is_identified AND member_id IS NOT NULL),
    'active_donors',       (SELECT count(*) FROM members WHERE is_donor),
    -- Por moneda: {"CRC": 1250000, "EUR": 340}. Una moneda sin movimientos no aparece.
    'total_this_month',    (SELECT COALESCE(json_object_agg(cur, monto), '{}'::json) FROM (
                              SELECT COALESCE(currency, 'CRC') cur, sum(amount) monto FROM donations
                              WHERE date_trunc('month', donation_date) = date_trunc('month', CURRENT_DATE)
                              GROUP BY 1) d),
    'unidentified_count',  (SELECT count(*) FROM donations WHERE NOT is_identified),
    'unidentified_total',  (SELECT COALESCE(json_object_agg(cur, monto), '{}'::json) FROM (
                              SELECT COALESCE(currency, 'CRC') cur, sum(amount) monto FROM donations
                              WHERE NOT is_identified GROUP BY 1) d)
  );
$$;

-- ── payment_stats ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.payment_stats() RETURNS json
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH t AS (
    SELECT COALESCE(currency, 'CRC') cur, status, payment_method, sum(amount) monto
    FROM payments GROUP BY 1, 2, 3
  )
  SELECT json_build_object(
    'total_paid',    (SELECT COALESCE(json_object_agg(cur, m), '{}'::json) FROM (
                        SELECT cur, sum(monto) m FROM t WHERE status = 'paid' GROUP BY 1) x),
    'total_card',    (SELECT COALESCE(json_object_agg(cur, m), '{}'::json) FROM (
                        SELECT cur, sum(monto) m FROM t WHERE status = 'paid' AND payment_method = 'card' GROUP BY 1) x),
    'total_sinpe',   (SELECT COALESCE(json_object_agg(cur, m), '{}'::json) FROM (
                        SELECT cur, sum(monto) m FROM t WHERE status = 'paid' AND payment_method = 'sinpe' GROUP BY 1) x),
    'total_pending', (SELECT COALESCE(json_object_agg(cur, m), '{}'::json) FROM (
                        SELECT cur, sum(monto) m FROM t WHERE status = 'pending' GROUP BY 1) x)
  );
$$;

-- ── dashboard_sums ──────────────────────────────────────────────────────────
-- Cambia el TIPO de income_this_month (numeric → json por moneda), así que hay
-- que soltar la función antes de recrearla.
DROP FUNCTION IF EXISTS public.dashboard_sums(timestamp with time zone, date);

CREATE FUNCTION public.dashboard_sums(p_month_start timestamp with time zone, p_month_start_date date)
RETURNS TABLE(income_this_month json, total_recipients bigint, servers_unique bigint)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT
    (SELECT COALESCE(json_object_agg(cur, monto), '{}'::json) FROM (
       SELECT COALESCE(currency, 'CRC') cur, sum(amount) monto
       FROM public.payments
       WHERE status = 'paid' AND payment_date >= p_month_start_date
       GROUP BY 1) p),
    COALESCE((SELECT SUM(total_recipients)
              FROM public.message_broadcasts
              WHERE created_at >= p_month_start), 0),
    COALESCE((SELECT COUNT(DISTINCT member_id)
              FROM public.volunteers
              WHERE status = 'active'), 0)
$$;

ALTER FUNCTION public.dashboard_sums(timestamp with time zone, date) OWNER TO postgres;
GRANT ALL ON FUNCTION public.dashboard_sums(timestamp with time zone, date) TO anon, authenticated, service_role;

-- ── Devoluciones: el tope se calcula DENTRO de la moneda del pago ────────────
-- Un refund hereda la moneda del pago, así que en la práctica el conjunto ya es
-- homogéneo; el filtro explícito evita que una fila con otra moneda (importada
-- o metida a mano) infle el total devuelto y bloquee una devolución legítima.
CREATE OR REPLACE FUNCTION public.create_refund(
  p_payment_id uuid, p_member_id uuid, p_amount numeric, p_method text,
  p_reason text, p_sinpe_pending boolean, p_notes text DEFAULT NULL::text)
RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_pay payments%ROWTYPE;
  v_refunded numeric;
  v_id uuid;
BEGIN
  SELECT * INTO v_pay FROM payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'not_found'); END IF;
  IF v_pay.status NOT IN ('paid', 'partial_refund') THEN
    RETURN jsonb_build_object('code', 'not_refundable', 'status', v_pay.status);
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('code', 'invalid_amount');
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_refunded
  FROM refunds
  WHERE payment_id = p_payment_id
    AND status IN ('pending', 'processing', 'completed')
    AND coalesce(currency, 'CRC') = coalesce(v_pay.currency, 'CRC');
  IF p_amount + v_refunded > v_pay.amount THEN
    RETURN jsonb_build_object('code', 'exceeds', 'max', v_pay.amount - v_refunded);
  END IF;

  INSERT INTO refunds (payment_id, member_id, amount, currency, method, reason, sinpe_pending, notes)
  VALUES (p_payment_id, coalesce(p_member_id, v_pay.member_id), p_amount, coalesce(v_pay.currency, 'CRC'), p_method, p_reason, coalesce(p_sinpe_pending, false), p_notes)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('code', 'ok', 'id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.process_refund(
  p_refund_id uuid, p_status text,
  p_processed_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_note text DEFAULT NULL::text)
RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ref refunds%ROWTYPE;
  v_pay payments%ROWTYPE;
  v_completed numeric;
BEGIN
  SELECT * INTO v_ref FROM refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('code', 'not_found'); END IF;

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
    FROM refunds
    WHERE payment_id = v_ref.payment_id AND status = 'completed'
      AND coalesce(currency, 'CRC') = coalesce(v_pay.currency, 'CRC');
    UPDATE payments
    SET status = CASE WHEN v_completed >= v_pay.amount THEN 'refunded' ELSE 'partial_refund' END
    WHERE id = v_ref.payment_id;
  END IF;

  RETURN jsonb_build_object('code', 'ok');
END $$;
