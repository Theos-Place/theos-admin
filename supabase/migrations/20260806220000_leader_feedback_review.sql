-- Retroalimentación al dirigente: paso de REVISIÓN antes de compartirla (2026-08-06)
--
-- Decisión de TI: los resultados NO le llegan al dirigente automáticamente. Un
-- coordinador los lee primero y recién ahí los comparte. El motivo es obvio en
-- cuanto se piensa: un comentario escrito en caliente puede ser injusto o
-- directamente ofensivo, y una vez que el dirigente lo leyó no hay vuelta atrás.
--
-- Dos niveles, porque "revisar" en la práctica son dos cosas distintas:
--  1. OCULTAR un comentario puntual que no corresponde (queda guardado para la
--     coordinación, pero el dirigente no lo ve). No se borra: si se borrara, no
--     habría cómo auditar la decisión.
--  2. COMPARTIR el lote con el dirigente. Hasta que eso pasa, el dirigente no ve
--     ni el promedio.

ALTER TABLE public.leader_evaluations
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

COMMENT ON COLUMN public.leader_evaluations.hidden_at IS
  'Comentario ocultado por la coordinación: no se le muestra al dirigente. La NOTA sigue contando en el promedio — ocultar un comentario no es descartar la evaluación.';

ALTER TABLE public.study_groups
  ADD COLUMN IF NOT EXISTS feedback_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_released_by UUID REFERENCES public.members(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.study_groups.feedback_released_at IS
  'Cuándo la coordinación compartió la retroalimentación con el dirigente. NULL = todavía sin revisar; el dirigente NO ve nada.';

-- El listado por revisar es "grupos con evaluaciones y sin compartir".
CREATE INDEX IF NOT EXISTS idx_study_groups_feedback_por_revisar
  ON public.study_groups (feedback_requested_at)
  WHERE feedback_requested_at IS NOT NULL AND feedback_released_at IS NULL;
