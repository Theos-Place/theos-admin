-- PRE-8 (corrección) · El cierre de prematrimonial, para grupos creados a mano.
--
-- EL BUG, reportado por Floriana el 2026-10-13 intentando cerrar su grupo.
-- La evaluación de pareja del cierre colgaba OBLIGATORIAMENTE de una
-- solicitud de la cola (`request_id` NOT NULL). Pero en producción hay UNA
-- sola solicitud prematrimonial, pendiente y sin grupo: los cinco grupos
-- abiertos se crearon A MANO.
--
-- Resultado: el cierre no encontraba ninguna pareja, no mostraba el
-- formulario, y quien cerraba veía una pantalla que no le pedía nada de lo
-- que tenía que llenar. El dato siempre estuvo ahí —en un grupo
-- prematrimonial los dos participantes SON la pareja, y los mentores son el
-- dirigente y el co-dirigente— pero se buscaba en el lugar equivocado.
--
-- `request_id` pasa a ser opcional. Cuando el grupo nace de la cola se sigue
-- guardando igual que antes; cuando se creó a mano, la evaluación cuelga del
-- GRUPO, que es lo único estable que la identifica.
--
-- LA UNICIDAD se parte en dos índices parciales en vez de relajarse:
-- una evaluación por solicitud, y una por grupo-sin-solicitud. Dejarla sin
-- restricción habría permitido dos evaluaciones del mismo cierre, y un
-- reintento duplicaría en vez de corregir — que es justo lo que el upsert
-- original estaba evitando.
--
-- No migra datos: la tabla está vacía (0 filas al 2026-10-13).

alter table public.prematrimonial_evaluations
  alter column request_id drop not null;

alter table public.prematrimonial_evaluations
  drop constraint if exists premat_eval_request_uniq;

create unique index if not exists premat_eval_request_uniq
  on public.prematrimonial_evaluations (request_id)
  where request_id is not null;

create unique index if not exists premat_eval_group_uniq
  on public.prematrimonial_evaluations (group_id)
  where request_id is null;

comment on column public.prematrimonial_evaluations.request_id is
  'La solicitud de la cola, si el grupo nació de ahí. NULL en los grupos creados a mano: esa evaluación se identifica por group_id (PRE-8, 2026-10-13).';
