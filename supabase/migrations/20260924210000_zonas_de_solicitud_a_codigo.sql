-- DAT-13b · `study_requests.proposed_zones` pasa de NOMBRES a CÓDIGOS.
--
-- Guardaba «Casona Escalante», «Este SJ» mientras `study_groups.zone` guarda
-- `casona-escalante`, `este-sj`: dos representaciones de lo mismo en dos
-- tablas. Funcionaba porque el scoring traducía al leer, pero los NOMBRES
-- CAMBIAN y los códigos no — el 2026-09-24 una zona pasó de «Sede Pedregal
-- Miércoles (código viejo)» a «Heredia», y una preferencia guardada por nombre
-- se queda apuntando a la nada sin que nada falle.
--
-- Son 8 solicitudes. Se convierten por nombre exacto contra `sedes`, y lo que
-- no calce se deja como está: `zonaCoincide` acepta código O nombre justamente
-- porque `proposed_location` —de donde salen las solicitudes viejas y el
-- «otra»— es texto libre y lo va a seguir siendo. Migrar limpia; no es lo que
-- hace que funcione.
--
-- «Cualquiera» NO se toca: es un centinela, no una sede.
--
-- UN CASO AMBIGUO QUE SE DEJA COMO ESTÁ, a propósito. Una solicitud del
-- 2026-09-07 (rechazada) pidió «Sede Pedregal Miércoles», y ESE NOMBRE LO
-- TENÍAN DOS SEDES a la vez —por eso la fusión del 2026-09-14—: la de código
-- `pedregal-miercoles` y la de código `heredia`, que era la que aparecía en el
-- selector de zonas. Hoy solo la primera conserva ese nombre, así que la
-- conversión la manda ahí.
--
-- Podría argumentarse que «debería» ser `heredia`, que es la fila que la
-- persona clickeó. No se hace: hoy esa fila se llama «Heredia» y significa otra
-- cosa, así que mapearla ahí sería inventarle a alguien una preferencia por una
-- zona que no pidió. `pedregal-miercoles` no calza con ningún grupo —igual que
-- no calzaba el nombre antes—, o sea que el comportamiento no cambia; lo que se
-- conserva es lo que la persona vio cuando eligió.
--
-- Idempotente: a la segunda corrida ya no hay nombres que convertir.

update study_requests r
   set proposed_zones = (
     select array_agg(
       coalesce(
         (select s.code from sedes s where s.name = z order by s.is_zone desc limit 1),
         z
       )
       order by idx
     )
     from unnest(r.proposed_zones) with ordinality as t(z, idx)
   )
 where array_length(r.proposed_zones, 1) > 0
   and exists (
     select 1 from unnest(r.proposed_zones) z
      where z <> 'Cualquiera'
        and exists (select 1 from sedes s where s.name = z)
   );
