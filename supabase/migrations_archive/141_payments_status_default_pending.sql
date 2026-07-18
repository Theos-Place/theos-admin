-- Auditoría db (docs/db-audit-2026-07-18.md) — hallazgo 🔴 §1/§2.
-- payments.status tenía DEFAULT 'paid': un pago creado sin status explícito
-- nacía marcado como cobrado. El estado inicial real del ciclo de pago es
-- 'pending' (el cobro se confirma después: SINPE, comprobante aprobado, etc.).
-- Un pago nunca debe nacer 'paid'.
--
-- El código acompaña este cambio: createPayment (src/lib/supabase/queries/finance.ts)
-- y el schema de POST /api/finance/payments pasan a exigir status explícito,
-- de modo que este default es solo una red de seguridad, no la vía normal.

ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'pending';
