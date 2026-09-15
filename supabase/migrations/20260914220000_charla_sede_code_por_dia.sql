-- charla_sede_code deja de mandar los del miércoles a la sede de los martes.
--
-- QUÉ ESTABA MAL. La función buscaba subcadenas en un orden fijo y sin mirar el
-- día, así que la primera coincidencia ganaba:
--   · "Charla Meridiano Miércoles" pegaba con %meridiano% → sede de los MARTES
--   · "Charla Pedregal Miércoles", "…Jueves" y "…Domingo" pegaban las tres con
--     %pedregal% → la misma sede, y encima inactiva
--   · "Charla Madrid Home Jueves" pegaba con %madrid% → la sede equivocada
--   · "Charla Heredia" / "Heredia Youth" → 'heredia', que se retiró al
--     fusionarla con 'pedregal-miercoles' (eran dos registros con el MISMO
--     nombre, "Sede Pedregal Miércoles", y la gente quedaba partida en dos)
--
-- Esto no era solo el reporte: refresh_member_sedes calcula la sede de cada
-- persona con esta función, y la elegibilidad cuenta por sede. Quien asistía
-- los miércoles a Pedregal o Meridiano tenía la sede equivocada.
--
-- EL ORDEN DE LOS CASOS ES LA REGLA: primero los que traen el día, después los
-- genéricos. Al revés, el genérico se come al específico — que es exactamente
-- lo que pasaba.

CREATE OR REPLACE FUNCTION public.charla_sede_code(p_title text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    -- ── Primero lo específico: sede + día ────────────────────────────────
    WHEN t LIKE '%meridiano%' AND (t LIKE '%mié%' OR t LIKE '%mie%') THEN 'meridiano-miercoles'
    WHEN t LIKE '%madrid%' AND t LIKE '%home%'                       THEN 'madrid-home'
    WHEN t LIKE '%pedregal%' AND (t LIKE '%mié%' OR t LIKE '%mie%')  THEN 'pedregal-miercoles'
    WHEN t LIKE '%pedregal%' AND t LIKE '%jueves%'                   THEN 'home'
    WHEN t LIKE '%pedregal%' AND t LIKE '%domingo%'                  THEN 'united'
    -- Heredia es el nombre VIEJO de Pedregal Miércoles (incluido su youth).
    WHEN t LIKE '%heredia%'                                          THEN 'pedregal-miercoles'
    -- "Theos Home" / "Home" a secas es el jueves de Pedregal.
    WHEN t LIKE '%theos home%'                                       THEN 'home'

    -- ── Después lo genérico ──────────────────────────────────────────────
    WHEN t LIKE '%pro oeste%' OR t LIKE '%meridiano%'                THEN 'meridiano'
    WHEN t LIKE '%pro este%' OR t LIKE '%antares%'                   THEN 'antares'
    WHEN t LIKE '%life escalante%'                                   THEN 'life-escalante'
    WHEN t LIKE '%life este%'                                        THEN 'life-este'
    WHEN t LIKE '%alajuela%'                                         THEN 'alajuela'
    WHEN t LIKE '%cartago%'                                          THEN 'cartago'
    WHEN t LIKE '%guapiles%' OR t LIKE '%guápiles%'                  THEN 'guapiles'
    WHEN t LIKE '%liberia%'                                          THEN 'liberia'
    WHEN t LIKE '%madrid%'                                           THEN 'madrid'
    WHEN t LIKE '%potrero%'                                          THEN 'potrero'
    WHEN t LIKE '%perez zeledon%' OR t LIKE '%pérez zeledón%'        THEN 'perez-zeledon'
    WHEN t LIKE '%united%'                                           THEN 'united'
    -- 'pedregal' a secas ya no resuelve a la sede inactiva del mismo nombre:
    -- sin día no hay forma de saber a cuál de las tres pertenece.
    ELSE NULL
  END
  FROM (SELECT lower(p_title) AS t) sub;
$function$;
