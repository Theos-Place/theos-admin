-- 039: columna generada con la cédula normalizada (sin guiones ni espacios)
-- para que el login por cédula sea un lookup indexado en vez de un full scan
-- comparando en JS. Misma normalización que normalizeCedula() en la app.
-- Índice normal (no UNIQUE): la data migrada tiene cédulas repetidas (ver 023).

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS cedula_normalized TEXT
  GENERATED ALWAYS AS (regexp_replace(cedula, '[-\s]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_members_cedula_normalized
  ON members (cedula_normalized);
