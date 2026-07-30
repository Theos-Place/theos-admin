-- EST-10 (preparación del módulo de formularios):
--  · tipo de campo 'info' — bloque de TEXTO INFORMATIVO sin input (contexto,
--    declaración doctrinal, textos largos). Antes 'section' solo pintaba una
--    línea con el título y su descripción nunca se mostraba.
--  · options_source — opciones DINÁMICAS traídas de la BD (p. ej. los grupos
--    abiertos de un plan) en vez de strings escritos a mano.
ALTER TABLE form_fields DROP CONSTRAINT IF EXISTS form_fields_field_type_check;
ALTER TABLE form_fields ADD CONSTRAINT form_fields_field_type_check CHECK (
  field_type = ANY (ARRAY[
    'text','textarea','number','email','phone','date','select','multiselect',
    'checkbox','radio','scale','file','personal_data','section_header',
    'yes_no','section','page_break','info'
  ])
);

ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS options_source text
  CHECK (options_source IS NULL OR options_source IN ('study_groups_open'));
-- Parámetro de la fuente (p. ej. el code del plan: 'CDEB').
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS options_source_param text;

COMMENT ON COLUMN form_fields.options_source IS
  'EST-10: si está seteado, las opciones se resuelven en el servidor al abrir el formulario (options_source_param lleva el filtro, p. ej. el code del plan).';
