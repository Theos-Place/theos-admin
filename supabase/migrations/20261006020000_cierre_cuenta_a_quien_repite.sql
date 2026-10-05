-- EST-24 · El cierre cuenta a quien está REPITIENDO el nivel.
--
-- EL CASO (reportado el 2026-10-05): Mariela Hernández llevó los cuatro
-- niveles en 2020 y los está volviendo a llevar con Ma. Fernanda Valverde.
-- Mafe cerró el Nivel 3, Mariela aprobó, y no salió en el correo de
-- aprobados — aunque estaba en el grupo y el dirigente la vio en la pantalla
-- de cierre.
--
-- POR QUÉ. La carga masiva del 18 de julio enganchó las aprobaciones viejas
-- a los grupos nuevos: la matrícula de Mariela en el grupo de 2026 nació ya
-- con `status = 'completed'` y `completed_at = 2020-06-29`. Los dos UPDATE
-- de esta función exigían `status = 'enrolled'`, así que su fila no calzaba
-- y el cierre la saltaba EN SILENCIO. Su `completed_at` se quedó en 2020, y
-- la regla que separa el arrastre del import —aprobó antes de que el grupo
-- empezara, así que no cuenta acá— la dejó fuera de la lista. La regla está
-- bien; lo que faltaba era que el cierre escribiera la fecha nueva.
--
-- POR QUÉ SOLTAR ESE CANDADO NO ES RIESGOSO. No protegía nada que el candado
-- del GRUPO no proteja ya: la primera sentencia exige `status <> 'finalizado'`
-- y devuelve false si el grupo ya se cerró, así que el bucle corre una sola
-- vez en la vida del grupo. Y el bucle recorre `p_results`, o sea ÚNICAMENTE
-- a quienes el dirigente evaluó.
--
-- QUÉ ENTRA Y QUÉ NO. Entra `completed`, el caso de quien repite. NO entran
-- `dropped`, `cancelada` ni `transferred`: son salidas deliberadas y un
-- cierre no debería revivirlas. `en_revision` tampoco, porque ya se reporta
-- aparte como «quedó sin evaluar» y mezclarlo taparía ese aviso.
--
-- ESTE ARCHIVO SE DERIVÓ DEL ORIGINAL QUE CORRE EN PRODUCCIÓN, no se
-- reescribió de memoria. La primera versión sí se escribió a mano a partir
-- de una lectura TRUNCADA y se comía el bloque de recomendaciones a CDEB
-- —el que guarda lo que el dirigente escribe al cerrar Discípulos 3 y
-- Panorama—. Lo agarró un diff contra producción antes de subirlo. Para
-- cambiar esta función: léanla entera con `pg_get_functiondef` y editen eso.
--
-- Medido en producción el 2026-10-05: 15 personas en 13 grupos de 2026
-- quedaron fuera de su correo de cierre por esto.

CREATE OR REPLACE FUNCTION public.close_group(p_group_id uuid, p_results jsonb, p_closed_by uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb;
  v_now timestamptz := now();
BEGIN
  UPDATE study_groups SET status = 'finalizado', closed_at = v_now, closed_by = p_closed_by
  WHERE id = p_group_id AND status <> 'finalizado';
  IF NOT FOUND THEN RETURN false; END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) LOOP
    IF r->>'status_result' = 'retirado' THEN
      UPDATE study_enrollments
      SET status = 'dropped', dropped_at = v_now,
          drop_reason = CASE
            WHEN coalesce(trim(r->>'withdraw_reason'), '') <> ''
              THEN 'Retirado en cierre: ' || trim(r->>'withdraw_reason')
            ELSE 'Retirado en cierre'
          END
      WHERE group_id = p_group_id AND member_id = (r->>'member_id')::uuid
        -- EST-24: antes era solo 'enrolled'. Quien repetía un nivel ya venía
        -- como 'completed' (arrastre del import) y el cierre lo saltaba en silencio.
        AND status IN ('enrolled', 'completed');
    ELSE
      UPDATE study_enrollments
      SET status = 'completed', completed_at = v_now,
          grade = NULLIF(r->>'grade', '')::numeric,
          notes = CASE
            WHEN r->>'status_result' = 'reprobado' AND coalesce(trim(r->>'fail_reason'), '') <> ''
              THEN 'reprobado: ' || trim(r->>'fail_reason')
            ELSE r->>'status_result'
          END
      WHERE group_id = p_group_id AND member_id = (r->>'member_id')::uuid
        -- EST-24: antes era solo 'enrolled'. Quien repetía un nivel ya venía
        -- como 'completed' (arrastre del import) y el cierre lo saltaba en silencio.
        AND status IN ('enrolled', 'completed');
    END IF;
  END LOOP;

  BEGIN
    INSERT INTO member_recommendations (member_id, recommended_for, justification, recommended_by, study_group_id)
    SELECT (r2->>'member_id')::uuid, k.key,
           NULLIF(trim(r2->'recommendations'->>'justification'), ''),
           p_closed_by, p_group_id
    FROM jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) r2,
         LATERAL (VALUES ('oracion'), ('servicio'), ('dirigente')) AS k(key)
    WHERE (r2->'recommendations'->>k.key)::boolean IS TRUE;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'close_group recomendaciones: %', SQLERRM;
  END;

  RETURN true;
END $function$;

-- SECURITY DEFINER y llamada desde el servidor con la llave de servicio
-- (AGENTS.md / SEC-3). `create or replace` conserva los permisos, pero se
-- dejan explícitos para que un `drop` futuro no la reabra.
revoke execute on function public.close_group(uuid, jsonb, uuid) from public, anon, authenticated;
grant  execute on function public.close_group(uuid, jsonb, uuid) to service_role;
