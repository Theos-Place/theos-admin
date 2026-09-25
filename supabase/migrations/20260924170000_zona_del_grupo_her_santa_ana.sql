-- «HER — Santa Ana» estaba en la zona de Pedregal.
--
-- El grupo tenía `zone = casona-pedregal` mientras su nombre, su ubicación
-- («Santa Ana Centro») y su horario apuntaban a Santa Ana. A diferencia de los
-- otros seis grupos con nombre y zona desalineados —donde el nombre es el que
-- quedó viejo y el campo está bien—, acá es al revés: el CAMPO es el
-- equivocado, y eso no es cosmético. La zona manda en los filtros, en los
-- reportes por zona y en la elegibilidad por `zone_preference`, así que el
-- grupo y sus 10 matrículas vigentes venían contando para Pedregal.
--
-- Encontrado al revisar por qué la pantalla de dirigentes mostraba una zona
-- que no era (2026-09-24); decisión de Floriana el mismo día.
--
-- Se identifica por id y no por nombre: hay un solo grupo con ese nombre hoy,
-- pero el nombre es texto que alguien puede repetir o editar, y el id no.
-- El `where` sobre la zona vieja la hace idempotente.

update study_groups
   set zone = 'santa-ana',
       updated_at = now()
 where id = 'b615a766-f72d-4aa3-bebc-ea1b8a40a212'
   and zone = 'casona-pedregal';
