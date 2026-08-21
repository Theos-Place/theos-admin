-- DIR-3 · Recordatorio de cierre de grupo.
--
-- Dos marcas de dedupe, una por aviso, con el mismo patrón que
-- study_groups.start_notified_at (mig 095): una vez mandado, no se repite.
--
-- La plantilla del PRIMER aviso (cierre_pendiente) ya existe desde la migración
-- 20260822110000. Acá se agrega la del SEGUNDO, que dice otra cosa: el grupo ya
-- terminó y sigue sin cerrar.

ALTER TABLE public.study_groups
  ADD COLUMN IF NOT EXISTS close_reminder_sent_at   timestamptz,
  ADD COLUMN IF NOT EXISTS close_overdue_notified_at timestamptz;

COMMENT ON COLUMN public.study_groups.close_reminder_sent_at IS
  'DIR-3: cuándo se avisó al dirigente que le tocaba cerrar (una semana antes del fin).';
COMMENT ON COLUMN public.study_groups.close_overdue_notified_at IS
  'DIR-3: cuándo se mandó el segundo y último aviso (el grupo terminó y sigue sin cerrar).';

-- El cron busca grupos en curso sin avisar: índice parcial, que es lo que se
-- consulta a diario.
CREATE INDEX IF NOT EXISTS idx_study_groups_close_pendiente
  ON public.study_groups (ends_at)
  WHERE status = 'en_curso';

INSERT INTO public.message_templates (name, channel, subject, body, body_format, category, is_system, system_key, is_active, available_variables)
SELECT
  'Cierre de estudio vencido (dirigente)', 'email',
  '{{nombre_estudio}} ya terminó y falta el cierre',
  '<p>Hola {{nombre}},</p>

   <p>Tu grupo de <strong>{{nombre_estudio}}</strong> ({{nombre_grupo}}) terminó el
   <strong>{{fecha_fin}}</strong> y todavía aparece abierto en el sistema.</p>

   <p>Mientras no lo cierres, tus estudiantes se quedan sin el registro de que llevaron el
   estudio, y eso les traba la matrícula del siguiente nivel. Es el último paso y toma unos
   minutos.</p>

   <p><a href="{{link_cierre}}">Hacer el cierre</a></p>

   <p>Si algo te está deteniendo —te falta información de alguien, o el grupo no terminó como
   estaba planeado— escribinos y lo resolvemos juntos. Este es el último recordatorio
   automático; de acá en adelante te busca la coordinación.</p>

   <p>Con cariño,<br>Equipo Theos Place</p>',
  'html', 'estudios', true, 'cierre_vencido', true,
  '["nombre", "nombre_estudio", "nombre_grupo", "fecha_fin", "link_cierre"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.message_templates WHERE system_key = 'cierre_vencido');
