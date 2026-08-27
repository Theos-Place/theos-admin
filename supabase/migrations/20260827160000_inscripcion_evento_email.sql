-- Correo de confirmación al inscribirse a un EVENTO (pedido 2026-08-27).
--
-- No existía: /eventos inscribía sin avisar nada. Estudios sí tenía el suyo
-- ('matricula_estudiante') y eventos solo tenía el aviso de cobro por check-in
-- ('event-charge-notify'), que es otro momento y otra cosa.
--
-- Se manda SIEMPRE, con pago pendiente o sin él: la inscripción ya reserva el
-- cupo, así que callarse deja a la persona sin saber si quedó. Las secciones
-- {{#pago_pendiente}} / {{#sin_pago}} funcionan como condicional — el motor de
-- render ignora lo que no es un array, así que el código manda uno vacío para
-- ocultar el bloque.
INSERT INTO public.message_templates (name, channel, subject, body, body_format, category, is_system, system_key, is_active, available_variables)
SELECT
  'Inscripción a evento confirmada', 'email',
  'Quedaste inscrito/a en {{nombre_evento}}',
  '<p>Hola {{nombre}},</p><p>Confirmamos tu inscripción a <strong>{{nombre_evento}}</strong>.</p><p><strong>Cuándo:</strong> {{fecha_evento}}<br><strong>Dónde:</strong> {{lugar_evento}}</p>{{#pago_pendiente}}<p>Queda pendiente el pago de <strong>{{monto}}</strong>. Tu cupo está reservado mientras subís el comprobante y lo revisamos. <a href="{{link_pago}}">Subir el comprobante</a></p>{{/pago_pendiente}}{{#sin_pago}}<p>No hay nada más que hacer: te esperamos.</p>{{/sin_pago}}',
  'html', 'transaccional', true, 'inscripcion_evento', true,
  '["nombre", "nombre_evento", "fecha_evento", "lugar_evento", "pago_pendiente", "sin_pago", "monto", "link_pago"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.message_templates WHERE system_key = 'inscripcion_evento');
