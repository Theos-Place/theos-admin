-- EST-14 · Un tiquete de folletos POR NIVEL, no uno por grupo.
--
-- Los folletos de un bloque se entregan juntos: un grupo de Nivel 1 necesita
-- los folletos de N1 y de N2, y uno de Nivel 3 los de N3 y N4. Eso son DOS
-- ítems imprimibles, con su cantidad cada uno.
--
-- EL ÍNDICE ÚNICO LO IMPEDÍA. `folleto_requests_auto_por_grupo` era único por
-- `source_group_id`, así que el segundo tiquete del par chocaba con 23505 y
-- el código lo trataba como «ya existe» — el grupo se habría quedado con el
-- folleto de N1 y sin el de N2, en silencio.
--
-- Se amplía a (source_group_id, target_level_code). La idempotencia se
-- conserva donde importa: un grupo sigue sin poder pedir DOS VECES el mismo
-- folleto por la vía automática, que es lo que el índice cuidaba.
--
-- No se toca ninguna fila: los tiquetes viejos tienen un solo nivel por grupo
-- y siguen cumpliendo el índice nuevo.

begin;

drop index if exists public.folleto_requests_auto_por_grupo;

create unique index folleto_requests_auto_por_grupo
    on public.folleto_requests (source_group_id, target_level_code)
 where tipo in ('cupo_lleno', 'fin_matricula', 'cierre');

commit;
