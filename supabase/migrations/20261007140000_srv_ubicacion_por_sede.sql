-- SRV · La ubicación de un puesto sale de la SEDE, no se escribe por vacante.
--
-- EL CASO (Floriana, 2026-10-07): el filtro «Todas las ubicaciones» de la
-- cartelera no filtra por ubicación — filtra por `area` («Área de
-- Ministerios»), solo está mal rotulado. Y en la cartelera pública, que sí
-- lee `vacancies.location`, el filtro ni siquiera aparece: las 32 vacantes
-- publicadas lo tienen en NULL.
--
-- POR QUÉ EL CANTÓN VA EN `sedes` Y NO EN CADA VACANTE. Son 26 vacantes de
-- 6 sedes: escribirlo vacante por vacante es repetir el mismo dato 26 veces
-- y volver a repetirlo con cada puesto nuevo. En la sede se pone una vez y
-- lo heredan todas, incluidas las que todavía no existen.
--
-- POR QUÉ UNA COLUMNA NUEVA Y NO `sedes.location`. Esa ya existe y es otra
-- cosa: el LUGAR («Plaza Antares, San Pedro», «Rancho Típico El Ensueño»,
-- «Donde Pipe, Bo. Los Ángeles»). Sirve para llegar, no para filtrar —
-- nadie busca puestos por «Rancho Típico El Ensueño»—. Y está incompleta:
-- Meridiano Miércoles, que es el ejemplo del pedido, la tiene vacía.
--
-- NACE VACÍA A PROPÓSITO. El cantón de cada sede no está en ningún lado del
-- sistema y no se puede derivar de nada: lo sabe el equipo. Llenarla con una
-- suposición sería peor que dejarla vacía, porque un filtro que dice
-- «Escazú» sobre una sede que no está en Escazú manda a alguien al lugar
-- equivocado. Mientras esté vacía el filtro simplemente no aparece, que es
-- exactamente lo que pasa hoy.
--
-- Los comités que NO son sede no llevan ubicación, como pidió Floriana: un
-- puesto del Comité Campamentos o del Comité Youth no se hace en un cantón.

alter table public.sedes
  add column if not exists canton text;

comment on column public.sedes.canton is
  'El cantón donde se reúne la sede (Escazú, Belén…). Es lo que se usa para FILTRAR puestos por ubicación. Distinto de `location`, que es el lugar exacto para llegar.';
