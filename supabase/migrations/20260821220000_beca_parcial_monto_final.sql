-- FIN-5 · La plantilla de beca parcial ahora dice el MONTO FINAL a pagar.
--
-- Decía "El resto del monto quedaría a tu cargo" sin el número, así que la
-- persona sabía el descuento pero no cuánto transferir — el mismo problema que
-- FIN-3 arregló en el modal de pago.
--
-- {{monto_final}} viene de approveScholarshipRequest, ya formateado en la
-- moneda del destino. Si el destino no tiene costo conocido llega vacío, y por
-- eso la frase se mantiene entendible sin el número.

UPDATE public.message_templates
SET body = '<p>Hola {{nombre}},</p>

      <p>Revisamos tu solicitud de beca para {{nombre_estudio_evento}} y pudimos aprobarte un apoyo parcial.</p>

      <p>Se te asignó un descuento de <strong>{{descuento}}</strong>, que se aplica solo al momento de pagar. Con ese descuento, el monto que te queda por pagar es <strong>{{monto_final}}</strong>.</p>

      <p><strong>¿Cómo la usás?</strong><br>
      Cuando vayás a inscribirte, elegí tu beca en el paso de pago y el descuento se aplica solo. Vas a ver el monto ya ajustado, y solo tenés que subir el comprobante por ese saldo.</p>

      <p>Ojalá este apoyo te ayude a dar el paso. Si tenés alguna duda, escribinos con confianza.</p>

      <p>Con cariño,<br>Equipo Theos Place</p>'
WHERE system_key = 'beca_aprobada_parcial';
