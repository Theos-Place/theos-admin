-- Prerequisito de etapa intermedia (2026-07-17). Regla: todo estudio de etapa
-- intermedia requiere como mínimo Panorama (PAN), salvo:
--   · la cadena Discípulos: DIS1←SCJ, DIS2←DIS1, DIS3←DIS2 (ya lo tienen),
--   · Panorama: PAN←DIS3,
--   · CTBD (Cómo Tomar Buenas Decisiones): va en la cadena de discipulado, ←DIS3.
-- Estos estudios estaban sin prerequisito (o CDEB/CDC que se veían mal en el
-- análisis). Se les fija PAN. Idempotente.
UPDATE study_plans
SET prerequisite_code = 'PAN', updated_at = now()
WHERE code IN ('CDEB', 'CDC', 'APO', 'EFE', 'GAL', 'MDM')
  AND prerequisite_code IS DISTINCT FROM 'PAN';
