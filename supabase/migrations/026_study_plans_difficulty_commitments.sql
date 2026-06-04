-- ============================================================
-- study_plans: dificultad y compromisos
-- ============================================================
-- 'difficulty' es la etiqueta de dificultad (Básico/Intermedio/Avanzado),
-- distinta de 'level' (la categoría: niveles/etapa_inicial/etapa_intermedia/campanas).
-- 'commitments' es el texto de compromisos requeridos visible al miembro.
-- mentor_id ya existe desde 001; aquí solo se exponen las dos columnas faltantes.

ALTER TABLE study_plans
  ADD COLUMN IF NOT EXISTS difficulty  TEXT CHECK (difficulty IN ('Básico', 'Intermedio', 'Avanzado')),
  ADD COLUMN IF NOT EXISTS commitments TEXT;
