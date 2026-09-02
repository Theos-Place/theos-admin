-- Folletos: lo que hacía falta para que un tiquete se pueda leer solo.
--
-- 1) origin_group_id — el tiquete de tipo 'cierre' se crea para el grupo
--    SUCESOR, así que source_group_id apunta al sucesor y el grupo que
--    realmente se cerró no quedaba registrado en ninguna parte. Sin ese
--    enlace no hay forma de decir cuántos aprobaron, reprobaron o se
--    retiraron, que es justo lo que quien imprime necesita saber para
--    entender la cantidad.
--
-- 2) quantity_leaders — el dirigente y el co-dirigente también dan el
--    estudio y también necesitan folleto. `quantity` se deja como estaba
--    (estudiantes) para no reinterpretar el histórico: los tiquetes viejos
--    quedan en NULL, que se lee como "no se registró", no como cero.

alter table public.folleto_requests
  add column if not exists origin_group_id uuid references public.study_groups(id) on delete set null,
  add column if not exists quantity_leaders integer;

comment on column public.folleto_requests.origin_group_id is
  'Grupo que se cerró y originó el tiquete (tipo=cierre). source_group_id es el grupo SUCESOR, el que va a usar los folletos.';
comment on column public.folleto_requests.quantity_leaders is
  'Folletos para dirigente + co-dirigente (0, 1 o 2). NULL = tiquete anterior a 2026-09-02, no se registró.';

-- La cola de folletos filtra y agrupa por tiquete; el enlace al origen se
-- consulta de a uno (pantalla de detalle), pero el índice evita el scan
-- cuando se busca "¿qué tiquete salió del cierre de este grupo?".
create index if not exists folleto_requests_origin_group_idx
  on public.folleto_requests (origin_group_id)
  where origin_group_id is not null;
