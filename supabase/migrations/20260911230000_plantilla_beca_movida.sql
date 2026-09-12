-- Plantilla del correo que avisa que una beca CAMBIÓ DE DESTINO.
--
-- Caso que la motiva: dos personas pidieron beca para Romanos, se les aprobó y
-- el único grupo abierto se llenó (10/10) antes de que se matricularan. La beca
-- se puede mover a otro estudio, pero la persona ya tenía un correo diciendo
-- "tu beca para Romanos": si el cambio no se le avisa, va a buscar un estudio
-- donde ya no hay campo.
--
-- No se reusó 'beca_aprobada' porque diría "tu solicitud fue aprobada" por
-- segunda vez, sin explicar por qué cambió el estudio.
--
-- {{monto_final}} llega vacío cuando la beca cubre todo; por eso la frase del
-- saldo va en su propio párrafo condicional ({{#queda_saldo}}), igual que
-- inscripcion_evento.

INSERT INTO public.message_templates (name, channel, subject, body, is_active, is_system, system_key, category, available_variables)
VALUES (
  'Beca movida a otro estudio',
  'email',
  'Tu beca ahora aplica a {{nombre_estudio_evento}}',
  '<p>Hola {{nombre}},</p>

      <p>Tu beca ya no está asignada a {{nombre_anterior}}: la pasamos a <strong>{{nombre_estudio_evento}}</strong>.</p>

      <p>{{motivo}}</p>

      <p>El descuento sigue siendo de <strong>{{descuento}}</strong>.{{#queda_saldo}} Con ese descuento, el monto que te queda por pagar es <strong>{{monto_final}}</strong>.{{/queda_saldo}}</p>

      <p><strong>¿Cómo la usás?</strong><br>
      Cuando vayás a matricularte en {{nombre_estudio_evento}}, elegí tu beca en el paso de pago y el monto se ajusta solo.</p>

      <p>Si preferís otro estudio o tenés alguna duda, escribinos con confianza.</p>

      <p>Con cariño,<br>Equipo Theos Place</p>',
  true, true, 'beca_movida', 'transaccional',
  '["nombre","nombre_anterior","nombre_estudio_evento","motivo","descuento","monto_final"]'::jsonb
)
ON CONFLICT DO NOTHING;
