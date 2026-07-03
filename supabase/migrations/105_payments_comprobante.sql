-- Capa de pago por comprobante sobre la tabla payments existente (abstracción de
-- método; tilopay se enchufa después vía payment_method='tilopay' + gateway_ref).
-- No se toca la semántica de finanzas: 'status' (paid/pending/…) se mantiene; el
-- flujo de revisión de comprobante usa la columna nueva 'review_status'.

-- Método de pago: sumar 'comprobante' (ahora) y 'tilopay' (futuro).
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method = ANY (ARRAY['card','sinpe','scholarship','cash','comprobante','tilopay']::text[]));

-- Concepto del pago y referencia al objeto pagado.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS concept text
  CHECK (concept IS NULL OR concept = ANY (ARRAY['matricula','folletos']::text[]));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES study_enrollments(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS folleto_request_id uuid REFERENCES folleto_requests(id) ON DELETE SET NULL;

-- Comprobante (screenshot) en Storage privado + estado de revisión.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_path text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS review_status text
  CHECK (review_status IS NULL OR review_status = ANY (ARRAY['en_revision','aprobado','rechazado']::text[]));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_payments_review_status ON payments(review_status);
CREATE INDEX IF NOT EXISTS idx_payments_enrollment ON payments(enrollment_id);

-- Bucket PRIVADO para comprobantes (datos bancarios). Acceso solo vía service role
-- en las rutas API (URLs firmadas de corta duración); nunca público.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;
