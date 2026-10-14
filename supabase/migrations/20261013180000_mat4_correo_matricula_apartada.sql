-- MAT-4 · El aviso INMEDIATO cuando una matrícula queda a medias.
--
-- Pedido de Floriana el 2026-10-13, después de ver que a cuatro personas les
-- quedaban 40 horas de plazo sin haber recibido todavía ningún correo.
--
-- POR QUÉ VUELVE UN AVISO AL MATRICULARSE, que se había quitado el
-- 2026-09-01. Aquel se quitó porque llegaba cuando la persona YA HABÍA
-- PAGADO: era un «te falta pagar» a quien acababa de pagar. Este es otro
-- correo y por eso no repite el problema — está redactado como CONFIRMACIÓN
-- («te apartamos el campo, falta un paso»), así que sirve igual si la
-- persona sube el comprobante cinco minutos después. Lo que no puede pasar
-- es que alguien se vaya del sistema sin saber que quedó algo pendiente.
--
-- EL HUECO QUE TAPA. El aviso de las 24 horas funciona, pero el cron corre
-- una vez al día a las 10:00: quien se matricula a las 10:15 cumple las 24
-- horas quince minutos después de que el cron pase, así que su primer
-- correo llega casi 48 horas más tarde, con el plazo ya medio consumido.
-- Pasó exactamente así con los cuatro de «N1 — Escazú» el 12 de octubre.
--
-- Los dos avisos conviven y dicen cosas distintas: este dice «falta esto»,
-- el de 24 horas dice «se te vence».

INSERT INTO public.message_templates (name, channel, subject, body, body_format, category, is_system, system_key, is_active, available_variables)
SELECT
  'Matrícula apartada (falta el comprobante)', 'email',
  'Te apartamos tu campo en {{nombre_grupo}} — falta un paso',
  '<p>Hola {{nombre}},</p>

   <p>Te apartamos tu campo en <strong>{{nombre_grupo}}</strong>. Para dejarlo
   confirmado falta un paso: <strong>subir el comprobante del pago</strong>
   de {{monto}}.</p>

   <p>Tenés <strong>{{horas_de_plazo}} horas</strong> para hacerlo. Si no, el campo
   se libera solo para que lo tome otra persona — no tenés que avisar nada.</p>

   <p>Si ya hiciste el SINPE, solo falta adjuntar la imagen.</p>

   <p><a href="{{link_pago}}">Subir el comprobante</a></p>

   <p>Con cariño,<br>Equipo Theos Place</p>',
  'html', 'estudios', true, 'matricula_apartada', true,
  '["nombre", "nombre_grupo", "monto", "horas_de_plazo", "link_pago"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.message_templates WHERE system_key = 'matricula_apartada');
