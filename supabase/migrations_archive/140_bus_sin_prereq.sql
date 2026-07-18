-- "¿Adónde va este bus?" (BUS) es una charla evangelística temprana; no debe
-- requerir SCJ (que va después de N4). Se le quita el prerequisito (2026-07-17).
UPDATE study_plans
SET prerequisite_code = NULL, updated_at = now()
WHERE code = 'BUS';
