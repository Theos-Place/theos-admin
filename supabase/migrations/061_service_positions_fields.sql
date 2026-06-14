-- 061: Alinea service_positions con el formato real de puestos (Excel que usan
-- hoy): ubicación, cantidad, requisito de estudio (categoría), funciones, perfil,
-- expiración, destacado y área base. Backfill desde columnas viejas
-- (max_volunteers → quantity, requirements → study_requirement) para no perder
-- datos. Las viejas se conservan por compatibilidad.

ALTER TABLE service_positions
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS study_requirement TEXT,   -- "categoría": nivel de estudio requerido
  ADD COLUMN IF NOT EXISTS functions TEXT,            -- "funciones"
  ADD COLUMN IF NOT EXISTS profile TEXT,              -- "perfil"
  ADD COLUMN IF NOT EXISTS expires_at DATE,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS base_area_id UUID REFERENCES areas(id) ON DELETE SET NULL;  -- "área base"

UPDATE service_positions SET quantity = max_volunteers
  WHERE quantity IS NULL AND max_volunteers IS NOT NULL;
UPDATE service_positions SET study_requirement = requirements
  WHERE study_requirement IS NULL AND requirements IS NOT NULL AND requirements <> '';
