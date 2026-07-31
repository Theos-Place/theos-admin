-- Corrección: el prerequisito del curso prematrimonial (PREMAT) es Nivel 2,
-- no Nivel 4 (estaba mal configurado). La pareja debe tener N2 completado.
UPDATE study_plans SET prerequisite_code = 'N2' WHERE code = 'PREMAT';
