-- Cierre de grupo: comentario OPCIONAL al marcar a alguien como retirado.
--
-- Antes el RPC escribía `drop_reason = 'Retirado en cierre'` fijo, así que el
-- dirigente no tenía dónde explicar por qué se retiró la persona (se mudó, se
-- enfermó, cambió de horario). Ahora, si el resultado trae `withdraw_reason`, se
-- guarda junto al motivo; si no viene, queda como antes.
--
-- El resto de la función NO cambia: mismo claim de 'finalizado', mismos updates
-- de inscripciones y mismo bloque de recomendaciones.

CREATE OR REPLACE FUNCTION "public"."close_group"("p_group_id" "uuid", "p_results" "jsonb", "p_closed_by" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r jsonb;
  v_now timestamptz := now();
BEGIN
  UPDATE study_groups SET status = 'finalizado'
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
        AND status = 'enrolled';
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
        AND status = 'enrolled';
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
END $$;
