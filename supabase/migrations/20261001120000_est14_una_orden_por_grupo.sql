-- EST-14 · Vuelve a UNA orden de folletos por grupo.
--
-- La migración 20260930190000 amplió el índice único a
-- (source_group_id, target_level_code) para poder crear un tiquete POR
-- FOLLETO. Al probarlo se vio que no sirve: quien imprime recibía DOS pedidos
-- del mismo grupo, el mismo día y a la misma sede, y tenía que juntarlos.
--
-- Floriana lo pidió al revés (2026-10-01): una sola orden que cubra el par.
-- Qué folletos cubre se DERIVA del plan del grupo con `folletosQuePide` —la
-- misma regla que decide el cobro y el conteo de impresión—, así que no hace
-- falta guardarlo ni una columna nueva.
--
-- El índice vuelve a ser por grupo, que es la forma de que la BASE garantice
-- la regla y no solo el código.
--
-- ANTES DE CREARLO se consolidan los grupos que quedaron con dos órdenes: se
-- conserva la del PRIMER folleto del par y se borra la otra. En staging era
-- 1 grupo (de las pruebas); en producción esto nunca corrió, así que no hay
-- ninguno — pero el DELETE va igual, porque una migración que asume el estado
-- de la base es una que falla en la otra.

begin;

delete from public.folleto_requests f
 where f.tipo in ('cupo_lleno', 'fin_matricula', 'cierre')
   and exists (
     select 1 from public.folleto_requests o
      where o.source_group_id = f.source_group_id
        and o.tipo in ('cupo_lleno', 'fin_matricula', 'cierre')
        and o.target_level_code < f.target_level_code
   );

drop index if exists public.folleto_requests_auto_por_grupo;

create unique index folleto_requests_auto_por_grupo
    on public.folleto_requests (source_group_id)
 where tipo in ('cupo_lleno', 'fin_matricula', 'cierre');

commit;
