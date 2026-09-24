-- Zonas de estudio · «Sede Pedregal Miércoles (código viejo)» vuelve a ser «Heredia».
--
-- QUÉ SE VE MAL (reportado por Floriana el 2026-09-24): en el selector de
-- zonas de estudio aparece una zona llamada «Sede Pedregal Miércoles (código
-- viejo)», que no debería existir, y NO aparece Heredia.
--
-- SON LA MISMA FILA. La sede de código `heredia` es la zona de Heredia —su
-- `location` dice «Heredia Centro»— pero su NOMBRE quedó pisado el 2026-09-14
-- por `scripts/series-charlas-2026-09-14/aplicar.cjs`, que fusionó dos sedes
-- que se llamaban igual: conservó `pedregal-miercoles`, movió sus miembros y
-- eventos, y a la retirada le hizo `name = name || ' (código viejo)'`.
--
-- Esa fusión estaba bien PARA LA SEDE (hoy tiene 0 miembros y 0 eventos), pero
-- se llevó puesta la ZONA sin querer: los grupos de estudio guardan la zona por
-- CÓDIGO (`study_groups.zone`, texto suelto, sin FK), así que los grupos siguen
-- apuntando a `heredia` y solo cambió la etiqueta con que se muestran.
--
-- LOS TRES GRUPOS QUE CUELGAN DE ACÁ SE LLAMAN «SCJ — Heredia», «SCJ — Heredia»
-- y «N1 — Heredia», y se crearon el 24 y el 27 de agosto, ANTES de la fusión.
-- Por eso esto es un rename y no una mudanza: moverlos a Casona Pedregal
-- —la lectura literal del pedido— habría mandado tres grupos de Heredia a la
-- zona equivocada.
--
-- CASONA PEDREGAL NO SE TOCA: ya existe como zona (`casona-pedregal`) con 6
-- grupos. No hay nada que crear ni que reemplazar.
--
-- Idempotente: el WHERE exige el nombre viejo, así que correrla dos veces no
-- hace nada la segunda.

update sedes
   set name = 'Heredia',
       is_zone = true,
       updated_at = now()
 where code = 'heredia'
   and name = 'Sede Pedregal Miércoles (código viejo)';
