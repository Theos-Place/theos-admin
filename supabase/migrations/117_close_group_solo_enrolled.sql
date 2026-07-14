-- A4 (auditoría BE 2026-07-13): close_group transicionaba CUALQUIER inscripción
-- del grupo — incluidas las 'pendiente_de_pago', que podían quedar 'completed'
-- sin haber pagado (y disparar la auto-matrícula al siguiente nivel). Ahora
-- solo las 'enrolled' se completan/retiran; una pendiente de pago conserva su
-- estado (y su deuda) aunque el grupo cierre.
CREATE OR REPLACE FUNCTION close_group(p_group_id uuid, p_results jsonb, p_closed_by uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      SET status = 'dropped', dropped_at = v_now, drop_reason = 'Retirado en cierre'
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
REVOKE EXECUTE ON FUNCTION close_group(uuid, jsonb, uuid) FROM public, anon, authenticated;
