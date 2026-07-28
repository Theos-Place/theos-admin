-- BEC-1: correo de beca/cupón.
-- 1) Registro del envío en la propia beca (dedupe: la UI no reenvía sin
--    confirmación y muestra cuándo/a quién se mandó).
ALTER TABLE scholarships
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_to text;

-- 2) Plantilla del sistema para cupones genéricos asignados a una persona
--    (hermana de beca_aprobada/beca_aprobada_parcial: editable en BD, con
--    fallback embebido en src/lib/email/system-templates.ts).
INSERT INTO message_templates (name, channel, subject, body, body_format, is_system, system_key, available_variables)
VALUES (
  'Cupón asignado',
  'email',
  'Tenés un cupón de descuento',
  '<p>Hola {{nombre}},</p><p>Se te asignó un cupón de descuento para {{nombre_estudio_evento}}.</p><p>Código: <strong>{{codigo}}</strong> — descuento de {{descuento}}. Vence el {{vencimiento}}.</p><p>Usalo al momento de hacer tu pago.</p>',
  'html',
  true,
  'cupon_asignado',
  '["nombre","nombre_estudio_evento","codigo","descuento","vencimiento"]'::jsonb
)
ON CONFLICT (system_key) WHERE system_key IS NOT NULL DO NOTHING;
