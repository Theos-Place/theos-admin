-- EVE-4 · Formulario de inscripción y encuesta de satisfacción programada (2026-08-06)
--
-- A) FORMULARIO DE INSCRIPCIÓN
-- Decisión confirmada con TI (2026-08-06): la inscripción SIGUE siendo
-- event_registrations —es lo que maneja cupo, pago y check-in— y la respuesta
-- del formulario se le ENLAZA como información adicional. Al revés (la respuesta
-- ES la inscripción) dejaría el cupo y el cobro colgando de un formulario que se
-- puede editar o desactivar, y no habría forma de inscribir a alguien a mano.
--
-- B) ENCUESTA DE SATISFACCIÓN
-- events.requires_survey ya existía sin ningún flujo detrás. Acá va el resto:
-- QUÉ se manda (un formulario o una plantilla de correo), CUÁNDO (el momento ya
-- CALCULADO, no solo la regla — así el envío es predecible aunque después se
-- toque el evento) y el sello de enviado, que es el dedupe del cron.
-- A QUIÉNES: a quienes hicieron check-in. Quien no llegó no tiene qué evaluar
-- (decisión confirmada con TI). No es columna: se resuelve al enviar.

ALTER TABLE public.events
  -- A) el formulario que se llena al inscribirse
  ADD COLUMN IF NOT EXISTS registration_form_id UUID REFERENCES public.forms(id) ON DELETE SET NULL,
  -- B) la encuesta: destino (uno de los dos), momento y sello de envío
  ADD COLUMN IF NOT EXISTS survey_form_id     UUID REFERENCES public.forms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS survey_template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS survey_offset_hours INTEGER,
  ADD COLUMN IF NOT EXISTS survey_send_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS survey_sent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS survey_sent_count   INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.events.registration_form_id IS
  'EVE-4 · Formulario que se llena al inscribirse. La inscripción sigue siendo event_registrations; esto es información adicional.';
COMMENT ON COLUMN public.events.survey_offset_hours IS
  'EVE-4 · Regla elegida (horas después del fin del evento). NULL con survey_send_at = fecha y hora exactas.';
COMMENT ON COLUMN public.events.survey_send_at IS
  'EVE-4 · Momento CALCULADO del envío. Es lo que mira el cron — se guarda resuelto para que el envío sea predecible.';
COMMENT ON COLUMN public.events.survey_sent_at IS
  'EVE-4 · Sello del despacho. Es el dedupe: el cron solo toma eventos con esto en NULL.';

-- Un solo destino: o formulario o plantilla, nunca los dos.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_survey_target_check;
ALTER TABLE public.events ADD CONSTRAINT events_survey_target_check
  CHECK (survey_form_id IS NULL OR survey_template_id IS NULL);

-- El cron busca por (survey_send_at vencido, sin enviar): índice parcial chico.
CREATE INDEX IF NOT EXISTS idx_events_survey_pendiente
  ON public.events (survey_send_at)
  WHERE requires_survey AND survey_sent_at IS NULL;

-- A) el enlace respuesta ↔ inscripción
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS form_response_id UUID REFERENCES public.form_responses(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_registrations.form_response_id IS
  'EVE-4 · Respuesta del formulario de inscripción de este evento, si lo tiene. La inscripción vale aunque esto sea NULL.';

CREATE INDEX IF NOT EXISTS idx_event_registrations_form_response
  ON public.event_registrations (form_response_id)
  WHERE form_response_id IS NOT NULL;

-- Plantilla del sistema para la encuesta cuando el destino es un FORMULARIO
-- (si se elige una plantilla de correo, se usa esa). No borrable, como el resto
-- de las del sistema.
INSERT INTO public.message_templates (name, channel, subject, body, body_format, category, is_system, system_key, is_active, available_variables)
VALUES (
  'Encuesta de satisfacción de evento',
  'email',
  '¿Cómo te fue en {{nombre_evento}}?',
  '<p>Hola {{nombre}},</p><p>Gracias por acompañarnos en <strong>{{nombre_evento}}</strong>. Nos ayudaría mucho saber cómo te fue: es una encuesta corta.</p><p><a href="{{link_encuesta}}">Responder la encuesta</a></p><p>Gracias por tu tiempo.</p>',
  'html',
  'eventos',
  true,
  'encuesta_evento',
  true,
  '["nombre", "nombre_evento", "link_encuesta"]'::jsonb
)
ON CONFLICT DO NOTHING;
