-- Retroalimentación al dirigente (2026-08-06)
--
-- `leader_evaluations` existía desde el inicio pero era ESQUEMA SIN FLUJO: 0
-- filas, ninguna pantalla y ningún correo que la escribiera. Acá se le pone el
-- flujo: al cerrar un grupo, sus estudiantes califican a quien lo dirigió.
--
-- QUÉ CAMBIA EN LA TABLA
-- · member_id — quién respondió. Sirve para UNA cosa: que nadie responda dos
--   veces. Al dirigente NUNCA se le muestra: ve el promedio y los comentarios
--   sin nombres. Sin esta columna no había forma de deduplicar.
--   NULL = la escribió un coordinador a mano (el uso original de la tabla).
-- · group_id pasa a ser parte de la identidad de la respuesta: un estudiante
--   evalúa UNA vez por grupo. El índice único es parcial porque las filas del
--   coordinador (member_id NULL) no compiten entre sí.
--
-- POR QUÉ NO UN FORMULARIO DEL BUILDER: la evaluación tiene que quedar en
-- leader_evaluations para poder promediar por dirigente a lo largo del tiempo.
-- Una respuesta suelta en form_responses no se puede agregar así.

ALTER TABLE public.leader_evaluations
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leader_evaluations.member_id IS
  'Quién respondió. Solo para deduplicar: al dirigente se le muestra el promedio y los comentarios SIN nombres. NULL = evaluación cargada por un coordinador.';

COMMENT ON COLUMN public.leader_evaluations.score IS
  'Nota de 1 a 5.';

-- Un estudiante, una evaluación por grupo.
CREATE UNIQUE INDEX IF NOT EXISTS leader_evaluations_una_por_estudiante
  ON public.leader_evaluations (group_id, member_id)
  WHERE member_id IS NOT NULL;

-- El promedio por dirigente se consulta seguido; el listado por grupo también.
CREATE INDEX IF NOT EXISTS idx_leader_evaluations_leader ON public.leader_evaluations (leader_id);
CREATE INDEX IF NOT EXISTS idx_leader_evaluations_group  ON public.leader_evaluations (group_id);

-- La escala es 1-5: una nota fuera de rango no dice nada y rompe el promedio.
ALTER TABLE public.leader_evaluations DROP CONSTRAINT IF EXISTS leader_evaluations_score_check;
ALTER TABLE public.leader_evaluations ADD CONSTRAINT leader_evaluations_score_check
  CHECK (score >= 1 AND score <= 5);

-- Dedupe del envío: el correo de la encuesta sale UNA vez por grupo.
ALTER TABLE public.study_groups
  ADD COLUMN IF NOT EXISTS feedback_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.study_groups.feedback_requested_at IS
  'Sello del envío de la encuesta de retroalimentación al cerrar. NULL = todavía no se pidió.';

ALTER TABLE public.leader_evaluations ENABLE ROW LEVEL SECURITY;

-- Las queries de la app corren con service role (saltan RLS); esto es la red
-- para la llave anónima. Nadie lee evaluaciones desde el cliente.
DROP POLICY IF EXISTS leader_evaluations_admin ON public.leader_evaluations;
CREATE POLICY leader_evaluations_admin ON public.leader_evaluations
  FOR ALL TO authenticated
  USING (private.is_admin() OR private.has_any_role(ARRAY['direccion', 'coordinador_estudios', 'coordinador_dirigentes']))
  WITH CHECK (private.is_admin() OR private.has_any_role(ARRAY['direccion', 'coordinador_estudios', 'coordinador_dirigentes']));

-- Plantilla del sistema del correo que pide la evaluación.
INSERT INTO public.message_templates (name, channel, subject, body, body_format, category, is_system, system_key, is_active, available_variables)
SELECT
  'Retroalimentación al dirigente', 'email',
  '¿Cómo te fue en {{nombre_estudio}}?',
  '<p>Hola {{nombre}},</p><p>Terminaste <strong>{{nombre_estudio}}</strong> con {{nombre_dirigente}}. Nos ayudaría mucho saber cómo te fue: son dos preguntas y es anónimo para tu dirigente.</p><p><a href="{{link_encuesta}}">Responder</a></p><p>Gracias por tu tiempo.</p>',
  'html', 'estudios', true, 'retro_dirigente', true,
  '["nombre", "nombre_estudio", "nombre_dirigente", "link_encuesta"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.message_templates WHERE system_key = 'retro_dirigente');
