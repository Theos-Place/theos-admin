-- Categoría de plantillas: se quita el CHECK con la lista fija para permitir
-- crear categorías nuevas desde la UI. La columna queda como TEXT libre; las
-- categorías "conocidas" (bienvenida, recordatorio, …) siguen funcionando.
ALTER TABLE message_templates
  DROP CONSTRAINT IF EXISTS message_templates_category_check;
