-- FRM-7 (2026-10-26) · Responder de nuevo en actividades recurrentes.
--
-- `allow_multiple_responses` ya existía. Esto agrega la VENTANA: cuántos días
-- tienen que pasar desde la última respuesta de la misma persona para aceptar
-- otra. Default 2: hay actividades con dos ediciones en el mismo mes, así que
-- la ventana solo frena el doble envío accidental, no la edición siguiente.
-- Solo aplica cuando allow_multiple_responses = true.
alter table public.forms
  add column if not exists reanswer_after_days integer not null default 2
  check (reanswer_after_days >= 0);

comment on column public.forms.reanswer_after_days is
  'FRM-7 · Con allow_multiple_responses: días que deben pasar desde la última respuesta de la persona para aceptar otra. 0 = sin espera.';
