-- Campos nuevos de formulario: 'image' y 'studies_done'.
--
-- El CHECK de form_fields.field_type es una lista cerrada, y los dos tipos que
-- se agregaron el 2026-08-28 no estaban en ella: guardar un formulario que los
-- usara fallaba contra la base. Los tipos se habían agregado solo en TypeScript.
--
--   · image        — imagen adjunta a la respuesta (comprobantes). El valor que
--                    se guarda es el path del bucket privado form-uploads.
--   · studies_done — campo OCULTO que el servidor llena con los estudios
--                    aprobados de quien responde; sale en el export.
--
-- 'file' ya estaba permitido y el adaptador lo mapea a 'image', así que los
-- formularios viejos que lo usen siguen funcionando.

ALTER TABLE form_fields DROP CONSTRAINT IF EXISTS form_fields_field_type_check;

ALTER TABLE form_fields ADD CONSTRAINT form_fields_field_type_check
  CHECK (field_type = ANY (ARRAY[
    'text', 'textarea', 'number', 'email', 'phone', 'date',
    'select', 'multiselect', 'checkbox', 'radio', 'scale',
    'file', 'image', 'studies_done',
    'personal_data', 'section_header', 'yes_no', 'section', 'page_break', 'info'
  ]));
