-- Plantilla del sistema: recordatorio AL DIRIGENTE de que le toca hacer el
-- cierre de su grupo (pedido 2026-08-21).
--
-- Complementa a las dos que ya existen alrededor del cierre:
--   · retro_dirigente          → a los ESTUDIANTES, para que evalúen al dirigente
--   · retro_dirigente_resumen  → al DIRIGENTE, con el resumen de esa evaluación
-- Faltaba el aviso previo: nadie le decía al dirigente que tenía que cerrar.
--
-- La usa DIR-3 (recordatorio una semana antes). is_system = true: editable desde
-- comunicaciones pero no borrable, porque el cron la busca por system_key.

INSERT INTO public.message_templates (name, channel, subject, body, body_format, category, is_system, system_key, is_active, available_variables)
SELECT
  'Cierre de estudio pendiente (dirigente)', 'email',
  'Te toca cerrar {{nombre_estudio}}',
  '<p>Hola {{nombre}},</p>

   <p>Tu grupo de <strong>{{nombre_estudio}}</strong> ({{nombre_grupo}}) termina el
   <strong>{{fecha_fin}}</strong>. Cuando den la última sesión, te toca hacer el cierre en el
   sistema.</p>

   <p>En el cierre marcás cómo le fue a cada estudiante —aprobado, reprobado o retirado— y, si el
   estudio lleva nota, la anotás. Eso es lo que actualiza el historial de cada persona y le abre
   la puerta al siguiente nivel, así que es importante que quede hecho.</p>

   <p>Apenas cerrés, a tus estudiantes les llega una encuesta corta para contarnos cómo les fue
   con vos. Es anónima, y después te compartimos el resumen.</p>

   <p><a href="{{link_cierre}}">Hacer el cierre</a></p>

   <p>Gracias por acompañar a este grupo hasta el final.</p>

   <p>Con cariño,<br>Equipo Theos Place</p>',
  'html', 'estudios', true, 'cierre_pendiente', true,
  '["nombre", "nombre_estudio", "nombre_grupo", "fecha_fin", "link_cierre"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.message_templates WHERE system_key = 'cierre_pendiente');
