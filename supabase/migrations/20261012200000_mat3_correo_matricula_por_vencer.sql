-- MAT-3 · El aviso de "te faltan 24 horas para el comprobante" ahora también
-- sale por CORREO.
--
-- POR QUÉ SE CAMBIA LA DECISIÓN DEL 2026-09-17. Ese día se definió que el
-- aviso fuera solo in-app, para no gastar envíos. Medido el 2026-10-12, un
-- mes después: de 11 avisos de `matricula_por_vencer`, se leyó 1 (9%); de 12
-- de `matricula_liberada`, 1 (8%). De las 11 personas avisadas, 6 igual
-- perdieron el cupo.
--
-- El motivo es estructural, no de volumen: la persona que necesita este aviso
-- es exactamente la que ya cerró el sistema y se fue. La campanita la espera
-- adentro. Mariel González (8528 6619) perdió el cupo DOS veces —16-set y
-- 4-oct— con las dos campanitas sin leer.
--
-- No se toca la decisión del 2026-09-01 (quitar el aviso AL MATRICULARSE):
-- esa se tomó porque llegaba cuando la persona ya había pagado, y a las 48
-- horas eso no aplica: si no subió el comprobante, no pagó.

INSERT INTO public.message_templates (name, channel, subject, body, body_format, category, is_system, system_key, is_active, available_variables)
SELECT
  'Matrícula por vencer (falta el comprobante)', 'email',
  'Te faltan {{horas}} horas para completar tu matrícula',
  '<p>Hola {{nombre}},</p>

   <p>Tu campo en <strong>{{nombre_grupo}}</strong> está apartado, pero la matrícula
   <strong>todavía no está completa</strong>: falta subir el comprobante del pago.</p>

   <p>Te quedan <strong>{{horas}} horas</strong>. Si no lo subís antes, el cupo se libera
   automáticamente para que lo tome otra persona.</p>

   <p>Si ya hiciste el SINPE, solo falta adjuntar la imagen — es cosa de un minuto.</p>

   <p><a href="{{link_pago}}">Subir el comprobante</a></p>

   <p>Si ya no querés el campo, no tenés que hacer nada: se libera solo.</p>

   <p>Con cariño,<br>Equipo Theos Place</p>',
  'html', 'estudios', true, 'matricula_por_vencer', true,
  '["nombre", "nombre_grupo", "horas", "link_pago"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.message_templates WHERE system_key = 'matricula_por_vencer');
