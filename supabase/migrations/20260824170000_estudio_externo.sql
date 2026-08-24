-- Estudios llevados POR FUERA de Theos (otra iglesia, otro ministerio).
--
-- El problema que resuelve: ya se podían registrar a mano —el botón "Agregar
-- estudio" crea una matrícula sin grupo— pero el dato quedaba INDISTINGUIBLE.
-- No servía `group_id IS NULL` como señal: al 2026-08-24 hay 25.610 matrículas
-- sin grupo de 40.474, casi todas del import histórico de CCB.
--
-- Importa poder distinguirlo porque un estudio registrado cuenta como
-- PRERREQUISITO: habilita a la persona para todo lo que venga después. Si
-- mañana hay que auditar por qué alguien entró a un estudio avanzado, "lo trajo
-- de otra iglesia y lo registró Fulano el 3 de marzo" es la respuesta; sin
-- estas columnas no hay ninguna.
--
-- `recorded_by` NO se agrega acá: ya existe desde FRM-4 (migración
-- 20260822180000). Se reutiliza tal cual, con el mismo significado.

ALTER TABLE public.study_enrollments
  ADD COLUMN IF NOT EXISTS es_externo      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fuente_externa  text;

COMMENT ON COLUMN public.study_enrollments.es_externo IS
  'true = la persona llevó este estudio FUERA de Theos y se registró a mano. El default false es correcto para todo lo existente: nada del histórico se marca retroactivamente porque no hay forma de saberlo.';

COMMENT ON COLUMN public.study_enrollments.fuente_externa IS
  'De dónde lo trajo: otra iglesia, otro ministerio, un instituto. Texto libre a propósito — la lista real es abierta y una tabla de catálogo sería mantenimiento sin beneficio.';

-- Coherencia: la procedencia solo tiene sentido si el estudio ES externo. Sin
-- esto quedaría `es_externo=false` con fuente llena, que no significa nada y
-- ensucia cualquier reporte que agrupe por fuente.
DO $$
BEGIN
  ALTER TABLE public.study_enrollments
    ADD CONSTRAINT study_enrollments_fuente_solo_si_externo
    CHECK (fuente_externa IS NULL OR es_externo);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Los reportes preguntan "¿cuáles son externos?", nunca "¿cuáles son internos?"
-- (esos son la enorme mayoría), así que el índice es parcial.
CREATE INDEX IF NOT EXISTS idx_study_enrollments_externo
  ON public.study_enrollments (member_id) WHERE es_externo;

GRANT SELECT, INSERT, UPDATE ON public.study_enrollments TO authenticated, service_role;
