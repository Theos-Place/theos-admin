-- ============================================================
-- Agregar members.medications
-- ============================================================
-- Medicamentos del miembro, similar a `allergies`. Texto libre.
-- Visible solo a roles autorizados (médicos, encargados de campamentos).

ALTER TABLE members ADD COLUMN medications TEXT;
