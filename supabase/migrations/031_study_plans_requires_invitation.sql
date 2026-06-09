-- Estudios que son solo por invitación (p.ej. capacitaciones de dirigentes).
ALTER TABLE study_plans ADD COLUMN IF NOT EXISTS requires_invitation BOOLEAN NOT NULL DEFAULT FALSE;
