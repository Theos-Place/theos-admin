-- 043: alinear study_plans con la cadena oficial del PDF del plan de estudios
-- (fuente de verdad para el análisis de demanda).
--
-- Correcciones principales: DIS1 tenía prereq BUS (oficial: SCJ) y varias
-- duraciones no coincidían. Solo se tocan los planes de la cadena oficial;
-- los planes históricos fuera de ella (BUS, APO, PREMAT, etc.) quedan igual.

-- ETAPA INICIAL (prereq N4)
UPDATE study_plans SET prerequisite_code = 'N4',   duration_weeks = 10 WHERE code = 'SCJ';
UPDATE study_plans SET prerequisite_code = 'N4',   duration_weeks = 10 WHERE code = 'ASF';
UPDATE study_plans SET prerequisite_code = 'N4',   duration_weeks = 8  WHERE code = 'EVM';
UPDATE study_plans SET prerequisite_code = 'N4',   duration_weeks = 8  WHERE code = 'AED';
UPDATE study_plans SET prerequisite_code = 'N4',   duration_weeks = 11 WHERE code = 'MAT';

-- ETAPA INTERMEDIA (cadena DIS → PAN → libros)
UPDATE study_plans SET prerequisite_code = 'SCJ',  duration_weeks = 10 WHERE code = 'DIS1';
UPDATE study_plans SET prerequisite_code = 'DIS1', duration_weeks = 9  WHERE code = 'DIS2';
UPDATE study_plans SET prerequisite_code = 'DIS2', duration_weeks = 10 WHERE code = 'DIS3';
UPDATE study_plans SET prerequisite_code = 'DIS3', duration_weeks = 10 WHERE code = 'PAN';
UPDATE study_plans SET prerequisite_code = 'DIS3', duration_weeks = 10 WHERE code = 'CTBD';
UPDATE study_plans SET prerequisite_code = 'PAN',  duration_weeks = 10 WHERE code = 'EVA';
UPDATE study_plans SET prerequisite_code = 'PAN',  duration_weeks = 8  WHERE code = 'HCH';
UPDATE study_plans SET prerequisite_code = 'PAN',  duration_weeks = 8  WHERE code = 'ROM';
UPDATE study_plans SET prerequisite_code = 'PAN',  duration_weeks = 8  WHERE code = 'HEB';
UPDATE study_plans SET prerequisite_code = 'PAN',  duration_weeks = 8  WHERE code = 'RDM';
UPDATE study_plans SET prerequisite_code = 'PAN',  duration_weeks = 8  WHERE code = 'DLF';
