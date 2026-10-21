-- SRV-20 (etapa 2) · `sirve_profile` como tipo de campo de formulario.
--
-- QUÉ ES. El bloque del perfil S.I.R.V.E., el MISMO que está en la pestaña
-- «Espiritual y S.I.R.V.E.», embebido en un formulario. No guarda una
-- respuesta: escribe directo en `member_spiritual_data`, igual que
-- `leader_availability` escribe en `study_leaders` (SRV-9). Es lo que
-- reemplaza al formulario 128 de CCB: quien termina Sirviendo como Jesús
-- abre el formulario, lo ve prellenado con lo que ya tiene, lo corrige, y lo
-- contestado queda en su perfil en vez de en respuestas que alguien
-- transcribe.
--
-- El CHECK es por qué esta migración existe (lección de SRV-9): sin ella, el
-- seed crea el formulario y muere al insertar el campo.

ALTER TABLE public.form_fields DROP CONSTRAINT IF EXISTS form_fields_field_type_check;
ALTER TABLE public.form_fields ADD CONSTRAINT form_fields_field_type_check
  CHECK (field_type = ANY (ARRAY[
    'text','textarea','number','email','phone','date','select','multiselect',
    'checkbox','radio','scale','file','image','studies_done','personal_data',
    'section_header','yes_no','section','page_break','info',
    'leader_availability',
    'sirve_profile'
  ]));
