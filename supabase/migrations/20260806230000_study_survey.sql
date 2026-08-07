-- EST-12 · Encuesta de satisfacción del dirigente, con formulario y envío
-- programado (2026-08-06)
--
-- Amplía lo que se hizo horas antes (una nota del 1 al 5 + comentario) al
-- cuestionario completo del plan: 10 preguntas cerradas + 2 abiertas, servidas
-- por el MÓDULO DE FORMULARIOS, no por campos a mano.
--
-- CÓMO SE RESUELVE EL SALTO grupo → dirigente (el punto 2 del plan):
-- el formulario es UNO SOLO para todos los grupos, así que no puede colgar de
-- una entidad concreta. La respuesta detallada vive en form_responses, y
-- `leader_evaluations` pasa a ser la PROYECCIÓN consultable: una fila por
-- respuesta con el grupo, el dirigente, el co-dirigente y la nota promedio.
-- Eso permite "todas las evaluaciones de tal dirigente" con un índice, sin
-- recalcular sobre form_response_values cada vez, y deja intacto el panel de
-- revisión que ya existe.

ALTER TABLE public.leader_evaluations
  -- La respuesta detallada. NULL = evaluación vieja (nota suelta) o cargada por
  -- un coordinador a mano.
  ADD COLUMN IF NOT EXISTS response_id UUID REFERENCES public.form_responses(id) ON DELETE CASCADE,
  -- El co-dirigente también recibe la evaluación del grupo que acompañó.
  ADD COLUMN IF NOT EXISTS co_leader_id UUID REFERENCES public.members(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leader_evaluations.response_id IS
  'EST-12 · Respuesta del formulario con el detalle por pregunta. leader_evaluations es la proyección consultable (grupo, dirigente, promedio).';

CREATE UNIQUE INDEX IF NOT EXISTS leader_evaluations_una_por_respuesta
  ON public.leader_evaluations (response_id) WHERE response_id IS NOT NULL;

-- Programación del envío, espejo de lo que ya tiene `events` (EVE-4).
ALTER TABLE public.study_groups
  -- Se puede apagar en un grupo puntual (p. ej. una cohorte de 2 personas).
  ADD COLUMN IF NOT EXISTS survey_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- Momento CALCULADO del envío. Lo pone el cierre; el cron mira esto.
  ADD COLUMN IF NOT EXISTS survey_send_at TIMESTAMPTZ,
  -- Desfase elegido respecto del cierre. Por defecto, el día siguiente.
  ADD COLUMN IF NOT EXISTS survey_offset_hours INTEGER NOT NULL DEFAULT 24;

COMMENT ON COLUMN public.study_groups.survey_send_at IS
  'EST-12 · Momento calculado del envío de la encuesta. Lo escribe el cierre; el cron study-surveys lo despacha. El sello de enviado es feedback_requested_at.';

-- El cron busca "programadas y vencidas, sin enviar".
CREATE INDEX IF NOT EXISTS idx_study_groups_survey_pendiente
  ON public.study_groups (survey_send_at)
  WHERE survey_send_at IS NOT NULL AND feedback_requested_at IS NULL;
