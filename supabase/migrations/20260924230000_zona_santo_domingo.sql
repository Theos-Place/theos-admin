-- DAT-13b · Santo Domingo es su propia zona de estudio.
--
-- Decisión de Floriana, 2026-09-24, sobre el planteo de Ari: Heredia y Santo
-- Domingo «son dos mundos». El dato acompaña: hay cuatro grupos reuniéndose en
-- «Santo Domingo, Heredia», y para comparar, la zona Heredia entera tiene tres
-- grupos activos, Belén dos y San Rafael de Alajuela tres. Santo Domingo solo
-- ya pesa como una zona existente.
--
-- LO QUE ESTO DESTRABA: tres de esos cuatro grupos —Niveles 1, 2 y 3, los tres
-- EN CURSO— no tenían NINGUNA zona. No es que estuvieran en la equivocada: no
-- aparecían en ningún filtro ni reporte por zona, y nadie que buscara «qué hay
-- cerca de Santo Domingo» los encontraba.
--
-- El cuarto, «SCJ — Heredia», sale de la zona Heredia. Su NOMBRE va a quedar
-- contradiciendo su zona, como los otros siete que ya están así: el nombre
-- lleva la zona escrita a mano y no se renombra al mudar el grupo (decisión de
-- Floriana el 2026-09-24). Las pantallas de dirigentes muestran la zona del
-- CAMPO desde el commit ca2c5bc2, así que el nombre viejo no engaña.
--
-- Los grupos se identifican por ID y no por un LIKE sobre `location`: un LIKE
-- se llevaría por delante a cualquier grupo futuro que alguien cree mientras
-- esta migración todavía no corrió en algún ambiente.
--
-- `is_active = false` como TODAS las zonas: esa bandera gobierna los selectores
-- de sede de miembros y eventos, que es otra cosa. Lo que la vuelve zona es
-- `is_zone`.

insert into sedes (code, name, is_active, is_zone)
values ('santo-domingo', 'Santo Domingo', false, true)
on conflict (code) do update set is_zone = true, name = excluded.name;

update study_groups
   set zone = 'santo-domingo', updated_at = now()
 where id in (
   '636e49bf-5fa5-471d-ad5c-4959b901ebb2',  -- Nivel 1. Fiorella Umaña. Agosto 2026
   '2e5b130b-e828-4021-b345-2830a9b0ebcb',  -- Nivel 2. Lissette Gómez. Julio 2026
   'ca5ea95b-ac49-46ec-a631-f2d1632d6cae',  -- Nivel 3. Daniella Sánchez R. Junio 2026
   'f9fb64b1-e42f-4a3f-950e-1200480ac5c7'   -- SCJ — Heredia (sale de la zona Heredia)
 )
   and coalesce(zone, '') <> 'santo-domingo';
