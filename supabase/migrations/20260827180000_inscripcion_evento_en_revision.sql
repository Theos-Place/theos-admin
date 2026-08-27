-- El correo de inscripción decía que el pago quedaba PENDIENTE. Es falso desde
-- que el comprobante es obligatorio para inscribirse (migración anterior +
-- cambio en la ruta de register): cuando el correo sale, el comprobante YA está
-- adentro.
--
-- Decirle "queda pendiente el pago" a quien acaba de pagar es peor que no decir
-- nada: o paga dos veces o escribe preguntando. Lo que falta no es el pago, es
-- que finanzas lo revise, y eso se resuelve internamente.
--
-- Cambia también el nombre de la sección: {{#pago_pendiente}} → {{#en_revision}}.
-- Se actualiza en vez de insertar porque la fila ya existe.
UPDATE public.message_templates
SET body = '<p>Hola {{nombre}},</p><p>Confirmamos tu inscripción a <strong>{{nombre_evento}}</strong>.</p><p><strong>Cuándo:</strong> {{fecha_evento}}<br><strong>Dónde:</strong> {{lugar_evento}}</p>{{#en_revision}}<p>Recibimos tu comprobante de <strong>{{monto}}</strong>. No tenés que hacer nada más: finanzas lo revisa y te avisamos si hiciera falta algo.</p>{{/en_revision}}{{#sin_pago}}<p>No hay nada más que hacer: te esperamos.</p>{{/sin_pago}}',
    available_variables = '["nombre", "nombre_evento", "fecha_evento", "lugar_evento", "en_revision", "sin_pago", "monto"]'::jsonb
WHERE system_key = 'inscripcion_evento';
