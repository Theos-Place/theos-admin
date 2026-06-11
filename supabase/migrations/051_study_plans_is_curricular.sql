-- Distingue los planes curriculares de las charlas introductorias que viven en
-- study_plans por razones históricas ("¿Adónde va este bus?"). Las no
-- curriculares se excluyen del análisis de demanda, el selector de análisis,
-- la matrícula y los listados del plan; el historial de quien la llevó queda
-- intacto (las inscripciones no se tocan).

ALTER TABLE study_plans ADD COLUMN IF NOT EXISTS is_curricular BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE study_plans SET is_curricular = FALSE WHERE code = 'BUS';
