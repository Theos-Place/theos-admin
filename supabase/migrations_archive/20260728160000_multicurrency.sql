-- INT-2: montos multimoneda (internacionalización Madrid/Colombia).
-- Cada tabla de dinero lleva su moneda (ISO 4217). Alcance inicial: CRC/USD/EUR,
-- SIN conversión automática — los reportes agregan por moneda (la regla de
-- consolidación es decisión de producto pendiente con dirección/finanzas).
-- Todo lo existente queda en CRC (default).

-- payments ya tenía currency (CRC/USD): se amplía el CHECK con EUR.
alter table "public"."payments" drop constraint if exists "payments_currency_check";
alter table "public"."payments" add constraint "payments_currency_check"
  check ("currency" = any (array['CRC'::text, 'USD'::text, 'EUR'::text]));

alter table "public"."donations" add column "currency" text not null default 'CRC'
  constraint "donations_currency_check" check ("currency" = any (array['CRC'::text, 'USD'::text, 'EUR'::text]));

alter table "public"."refunds" add column "currency" text not null default 'CRC'
  constraint "refunds_currency_check" check ("currency" = any (array['CRC'::text, 'USD'::text, 'EUR'::text]));

alter table "public"."scholarships" add column "currency" text not null default 'CRC'
  constraint "scholarships_currency_check" check ("currency" = any (array['CRC'::text, 'USD'::text, 'EUR'::text]));

-- Moneda del costo del plan: al matricular, el pago hereda esta moneda.
alter table "public"."study_plans" add column "currency" text not null default 'CRC'
  constraint "study_plans_currency_check" check ("currency" = any (array['CRC'::text, 'USD'::text, 'EUR'::text]));

-- Moneda de payment_amount (costo de inscripción del evento).
alter table "public"."events" add column "currency" text not null default 'CRC'
  constraint "events_currency_check" check ("currency" = any (array['CRC'::text, 'USD'::text, 'EUR'::text]));

-- create_refund (RPC transaccional, migración 116): la devolución hereda la
-- MONEDA del pago (una devolución siempre es en la moneda en que se cobró).
CREATE OR REPLACE FUNCTION "public"."create_refund"("p_payment_id" "uuid", "p_member_id" "uuid", "p_amount" numeric, "p_method" "text", "p_reason" "text", "p_sinpe_pending" boolean, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  WHERE payment_id = p_payment_id AND status IN ('pending', 'processing', 'completed');
  IF p_amount + v_refunded > v_pay.amount THEN
    RETURN jsonb_build_object('code', 'exceeds', 'max', v_pay.amount - v_refunded);
  END IF;

  INSERT INTO refunds (payment_id, member_id, amount, currency, method, reason, sinpe_pending, notes)
  VALUES (p_payment_id, coalesce(p_member_id, v_pay.member_id), p_amount, coalesce(v_pay.currency, 'CRC'), p_method, p_reason, coalesce(p_sinpe_pending, false), p_notes)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('code', 'ok', 'id', v_id);
END $$;
