-- Una segunda fuente dinámica de opciones: los TALLERES.
--
-- EL CASO (Floriana, 2026-10-08): la encuesta «Retroalimentación - Talleres
-- para Dirigentes» pide elegir el taller de una lista. Escribirla a mano
-- obligaría a editar el formulario cada vez que entre un taller nuevo, y a
-- que alguien se acuerde de hacerlo. Con la fuente dinámica el desplegable
-- lee los eventos de tipo `taller` y se mantiene solo.
--
-- El CHECK aceptaba UN solo valor, así que la fuente nueva reventaba el
-- insert. Se amplía en vez de quitarse: sin CHECK, un `options_source` mal
-- escrito —'talleres ' con espacio, 'Talleres' con mayúscula— se guardaría
-- sin protestar y el desplegable saldría vacío en producción sin ningún
-- error que lo delate.
--
-- La lista de fuentes válidas vive también en
-- `src/lib/forms/fuentes-dinamicas.ts`, que es quien las resuelve. Son dos
-- lugares a propósito: la base protege el dato y el código sabe leerlo.
-- `src/lib/forms/fuentes-y-check.test.ts` falla si se separan.

alter table public.form_fields
  drop constraint if exists form_fields_options_source_check;

alter table public.form_fields
  add constraint form_fields_options_source_check
  check (options_source is null or options_source in ('study_groups_open', 'talleres'));

comment on column public.form_fields.options_source is
  'Fuente dinámica de las opciones del desplegable. Las válidas están en el CHECK y en src/lib/forms/fuentes-dinamicas.ts; null = opciones escritas a mano en `options`.';
