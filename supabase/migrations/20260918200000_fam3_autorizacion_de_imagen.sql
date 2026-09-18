-- FAM-3 · Autorización para aparecer en fotos y publicaciones.
--
-- EL CAMPO ES NULLABLE Y SIN DEFAULT, y eso es lo importante:
--
--   NULL   = todavía no se le preguntó a nadie. Es el estado de las 24 mil
--            fichas que ya existen.
--   true   = dijo que sí.
--   false  = dijo que NO.
--
-- Un `default false` habría sido más cómodo y habría estado mal: "no me
-- preguntaron" y "me preguntaron y dije que no" no son lo mismo. Con el default
-- se pierde la diferencia para siempre —nadie podría distinguir a quién falta
-- consultar— y además se estaría afirmando una negativa que nadie dio.
--
-- Para los MENORES la diferencia es la que importa de verdad: publicar la foto
-- de un menor sin autorización de su familia es el caso que este campo viene a
-- evitar, y "pendiente" es la señal de que hay que ir a preguntar.
alter table public.members
  add column if not exists autorizacion_imagen boolean;

comment on column public.members.autorizacion_imagen is
  'Autorizado a aparecer en fotos y publicaciones. NULL = no se ha preguntado '
  '(distinto de false, que es una negativa explícita). Ver FAM-3.';

-- El índice es PARCIAL: la consulta que importa es "a quién falta preguntarle",
-- y sobre todo entre menores. Indexar la columna entera costaría en cada
-- escritura de members para responder una pregunta que nadie hace.
create index if not exists idx_members_autorizacion_pendiente
  on public.members (birth_date)
  where autorizacion_imagen is null and is_active;
