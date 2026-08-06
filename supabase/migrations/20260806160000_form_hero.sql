-- FRM-2 · Encabezado (hero) del formulario (2026-08-06)
--
-- Un formulario tiene que poder verse como una pieza de comunicación —flyer
-- arriba, título, bienvenida— y no como un cuestionario pelado.
--
-- POR QUÉ COLUMNAS EN `forms` Y NO UN TIPO DE CAMPO NUEVO en form_fields:
-- una fila de form_fields es una PREGUNTA. Arrastra cosas que al hero no le
-- aplican y que habría que apagar una por una: entra en el orden de los campos,
-- en la validación de obligatorios, en la lógica condicional, en el export de
-- respuestas y en form_response_values. El hero no se responde: es del
-- formulario, igual que su título y su descripción, que ya son columnas acá.
--
-- LA IMAGEN VA COMO URL, NUNCA COMO BASE64: ese fue justo el problema que EVE-2
-- vino a arreglar en eventos (events.flyer_url guardaba un data URL entero).
-- Sube a Storage, bucket público 'form-heroes', y acá queda el link.

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS hero_title     TEXT,
  ADD COLUMN IF NOT EXISTS hero_subtitle  TEXT;

COMMENT ON COLUMN public.forms.hero_image_url IS
  'FRM-2 · URL pública del flyer del encabezado (bucket form-heroes). NUNCA base64 — ver EVE-2.';
COMMENT ON COLUMN public.forms.hero_title IS
  'FRM-2 · Título del encabezado. Vacío = se usa el nombre del formulario.';
COMMENT ON COLUMN public.forms.hero_subtitle IS
  'FRM-2 · Bienvenida o bajada opcional del encabezado.';
