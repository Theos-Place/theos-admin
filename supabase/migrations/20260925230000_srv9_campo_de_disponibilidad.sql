-- SRV-9 · `leader_availability` como tipo de campo de formulario.
--
-- QUÉ ES. El bloque de disponibilidad del dirigente, el MISMO que está en su
-- perfil, embebido en un formulario. No guarda una respuesta: escribe directo
-- en `study_leaders`, igual que `personal_data` escribe en la ficha del
-- miembro. Es lo que deja armar la campaña de marzo/julio/noviembre con el
-- módulo de formularios —portada, audiencia, preguntas extra— sin que lo
-- contestado quede en respuestas que alguien tiene que transcribir, que es
-- exactamente lo que pasa hoy con los formularios de Linktree.
--
-- EL CHECK ES POR QUÉ ESTA MIGRACIÓN EXISTE: sin ella, el seed del formulario
-- crea el formulario y muere al insertar el campo, dejando un formulario vacío
-- a medio sembrar. Se descubrió así, corriéndolo contra staging.

ALTER TABLE public.form_fields DROP CONSTRAINT IF EXISTS form_fields_field_type_check;
ALTER TABLE public.form_fields ADD CONSTRAINT form_fields_field_type_check
  CHECK (field_type = ANY (ARRAY[
    'text','textarea','number','email','phone','date','select','multiselect',
    'checkbox','radio','scale','file','image','studies_done','personal_data',
    'section_header','yes_no','section','page_break','info',
    'leader_availability'
  ]));
