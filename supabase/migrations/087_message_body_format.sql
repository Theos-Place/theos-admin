-- Formato del cuerpo de plantillas y broadcasts: 'text' (texto plano, se escapa
-- y los saltos de línea se convierten a <br> al enviar) o 'html' (código HTML
-- crudo, se envía tal cual). Default 'html' para no cambiar el render de los
-- correos/plantillas existentes (que ya se mandaban como HTML crudo).
ALTER TABLE message_templates
  ADD COLUMN body_format TEXT NOT NULL DEFAULT 'html'
  CHECK (body_format IN ('text', 'html'));

ALTER TABLE message_broadcasts
  ADD COLUMN body_format TEXT NOT NULL DEFAULT 'html'
  CHECK (body_format IN ('text', 'html'));
