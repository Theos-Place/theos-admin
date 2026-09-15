-- FRM-5 · Limitar un formulario a cierto tipo de personas.
--
-- Mismo shape que study_groups.enrollment_restrictions (GRU-2): el filtro
-- avanzado del padrón serializado —conditions + groups + ops—. No es un modelo
-- nuevo a propósito; la pregunta "¿a quién va dirigido esto?" ya estaba
-- resuelta y dos modelos de lo mismo se desincronizan.
--
-- NULL = sin restricción, que es como se comportan todos los formularios de
-- hoy. Nada cambia para los existentes.
alter table public.forms
  add column if not exists audience_restrictions jsonb;

comment on column public.forms.audience_restrictions is
  'FRM-5 · A quién se le ofrece este formulario. Mismo shape que el filtro del padrón (ver lib/audiencia/restriccion.ts). NULL = abierto a todos. Una restricción exige saber quién es la persona, así que convive con requires_auth=true.';
