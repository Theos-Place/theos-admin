-- ID externo del sistema de origen (Planning Center "Individual ID") para
-- dedup idempotente al importar miembros desde el CSV.
ALTER TABLE members ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_external_id ON members(external_id) WHERE external_id IS NOT NULL;
