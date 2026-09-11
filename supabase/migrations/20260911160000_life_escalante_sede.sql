-- charla_sede_code no reconocía "Charla Life Escalante", así que sus 7.190
-- check-ins (ene-2020 → feb-2026) no contaban para asignarle sede a nadie:
-- 364 personas sin sede que solo asisten ahí, y otras 69 con la sede tomada de
-- una charla a la que fueron menos veces.
--
-- El código 'life-escalante' YA existía en la tabla sedes y el espejo en TS
-- (sedes-canonical.ts) ya lo mapeaba: el hueco era solo esta función.
--
-- La rama nueva va ANTES de '%life este%' por claridad; no se solapan
-- ("life escalante" no contiene "life este"), pero mantenerlas juntas evita que
-- la próxima edición las cruce.
--
-- Colegiales y Entre Mujeres NO se agregan: el usuario confirmó (2026-09-11)
-- que no son sedes — Entre Mujeres es un grupo de mujeres y Colegiales fue una
-- charla que dejó de existir. Sus filas en `sedes` quedan sin uso.
CREATE OR REPLACE FUNCTION public.charla_sede_code(p_title text)
 RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN t LIKE '%pro oeste%' OR t LIKE '%meridiano%' OR t LIKE '%theos home%' THEN 'meridiano'
    WHEN t LIKE '%pro este%' OR t LIKE '%antares%' THEN 'antares'
    WHEN t LIKE '%life escalante%' THEN 'life-escalante'
    WHEN t LIKE '%life este%' THEN 'life-este'
    WHEN t LIKE '%alajuela%' THEN 'alajuela'
    WHEN t LIKE '%cartago%' THEN 'cartago'
    WHEN t LIKE '%guapiles%' OR t LIKE '%guápiles%' THEN 'guapiles'
    WHEN t LIKE '%liberia%' THEN 'liberia'
    WHEN t LIKE '%madrid%' THEN 'madrid'
    WHEN t LIKE '%pedregal%' THEN 'pedregal'
    WHEN t LIKE '%potrero%' THEN 'potrero'
    WHEN t LIKE '%perez zeledon%' OR t LIKE '%pérez zeledón%' THEN 'perez-zeledon'
    WHEN t LIKE '%heredia%' THEN 'heredia'
    WHEN t LIKE '%united%' THEN 'united'
    ELSE NULL
  END
  FROM (SELECT lower(p_title) AS t) sub;
$function$;
