-- 2026-08-04 · La razón de una excepción de matrícula pasa a ser obligatoria.
--
-- Una excepción salta compromisos (donante, servidor, asistencia, prerequisito,
-- edad) sin dejar rastro de por qué. Es la decisión más discrecional del módulo
-- de estudios: tiene que quedar justificada para quien audite después.
--
-- Al aplicar: 3 excepciones, las 3 sin razón (2 activas). Se rellenan con un
-- texto explícito en vez de inventarles una justificación — que se note que son
-- de antes de la regla es parte del dato.

UPDATE study_requirement_exceptions
SET reason = 'Sin justificación registrada (excepción anterior al 2026-08-04)'
WHERE reason IS NULL OR length(trim(reason)) = 0;

ALTER TABLE public.study_requirement_exceptions
  ALTER COLUMN reason SET NOT NULL;

-- El mínimo también en la base: sin esto, cualquier camino que no pase por el
-- zod de la ruta (un script, el SQL editor) puede volver a dejar un espacio.
ALTER TABLE public.study_requirement_exceptions
  DROP CONSTRAINT IF EXISTS study_requirement_exceptions_reason_check;
ALTER TABLE public.study_requirement_exceptions
  ADD CONSTRAINT study_requirement_exceptions_reason_check
  CHECK (length(trim(reason)) >= 10);

COMMENT ON COLUMN public.study_requirement_exceptions.reason IS
  'Por qué se hizo la excepción. OBLIGATORIA desde 2026-08-04 (mínimo 10 caracteres); las anteriores llevan el texto de relleno de la migración.';
