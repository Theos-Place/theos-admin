-- 014: Finanzas — alinear payments/scholarships con el mock y crear las tablas
-- faltantes (donations, refunds, import_batches).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. payments: columnas faltantes + enums del frontend
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE payments
  ADD COLUMN entity_type        TEXT CHECK (entity_type IN ('event', 'study_group')),
  ADD COLUMN gateway_ref        TEXT,
  ADD COLUMN sinpe_confirmation TEXT,
  ADD COLUMN scholarship_id     UUID REFERENCES scholarships(id) ON DELETE SET NULL,
  ADD COLUMN paid_at            TIMESTAMPTZ;

-- método: el mock usa card/sinpe/scholarship/cash
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
UPDATE payments SET payment_method = 'cash' WHERE payment_method NOT IN ('card', 'sinpe', 'scholarship', 'cash');
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('card', 'sinpe', 'scholarship', 'cash'));

-- estado: el mock usa paid/pending/refunded/partial_refund/failed
ALTER TABLE payments ALTER COLUMN status DROP DEFAULT;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
UPDATE payments SET status = 'paid' WHERE status NOT IN ('paid', 'pending', 'refunded', 'partial_refund', 'failed');
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('paid', 'pending', 'refunded', 'partial_refund', 'failed'));
ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'paid';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. scholarships: modelo de descuento del frontend
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE scholarships
  ADD COLUMN entity_type     TEXT CHECK (entity_type IN ('study_group', 'event')),
  ADD COLUMN event_id        UUID REFERENCES events(id) ON DELETE SET NULL,
  ADD COLUMN discount_type   TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  ADD COLUMN discount_value  NUMERIC(12,2),
  ADD COLUMN original_amount NUMERIC(12,2),
  ADD COLUMN final_amount    NUMERIC(12,2),
  ADD COLUMN is_used         BOOLEAN DEFAULT FALSE,
  ADD COLUMN used_at         TIMESTAMPTZ,
  ADD COLUMN created_by      UUID REFERENCES auth.users(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. donations: donaciones importadas de archivo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE donations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID REFERENCES members(id) ON DELETE SET NULL,
  family_unit_id UUID REFERENCES family_units(id) ON DELETE SET NULL,
  donation_date  DATE NOT NULL,
  amount         NUMERIC(12,2) NOT NULL,
  source_file    TEXT,
  is_identified  BOOLEAN DEFAULT FALSE,
  imported_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_donations_member ON donations(member_id);
CREATE INDEX idx_donations_date   ON donations(donation_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. refunds: devoluciones de pagos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE refunds (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id   UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  member_id    UUID REFERENCES members(id) ON DELETE SET NULL,
  amount       NUMERIC(12,2) NOT NULL,
  method       TEXT CHECK (method IN ('card', 'sinpe', 'scholarship', 'cash')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                 'pending', 'processing', 'completed', 'rejected'
               )),
  reason       TEXT,
  sinpe_pending BOOLEAN DEFAULT FALSE,
  notes        TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_member  ON refunds(member_id);
CREATE INDEX idx_refunds_status  ON refunds(status);

CREATE TRIGGER set_updated_at_refunds
  BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. import_batches: lotes de importación de donaciones
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE import_batches (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename     TEXT NOT NULL,
  total_rows   INT DEFAULT 0,
  identified   INT DEFAULT 0,
  unidentified INT DEFAULT 0,
  duplicates   INT DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'completed' CHECK (status IN (
                 'completed', 'partial', 'failed'
               )),
  imported_by  UUID REFERENCES auth.users(id),
  imported_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS en las tablas nuevas (patrón normalizado)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['donations','refunds','import_batches']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$CREATE POLICY "%1$s_select" ON %1$I FOR SELECT TO authenticated USING ((select auth.role()) = 'authenticated')$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_insert" ON %1$I FOR INSERT TO authenticated WITH CHECK (private.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_update" ON %1$I FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_delete" ON %1$I FOR DELETE TO authenticated USING (private.is_admin())$f$, t);
  END LOOP;
END $$;
