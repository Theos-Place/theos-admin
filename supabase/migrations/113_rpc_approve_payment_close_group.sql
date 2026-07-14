-- B7 (revisión best practices 2026-07-13): las dos secuencias multi-paso que
-- tocan dinero/estado irrecuperable pasan a ser transaccionales (precedente:
-- merge_members 035, approve_applications 103).

-- ── approve_payment ───────────────────────────────────────────────────────
-- Antes (app): UPDATE payments → si el UPDATE de la matrícula fallaba, quedaba
-- dinero cobrado con matrícula 'pendiente_de_pago' y solo un console.warn.
-- Devuelve false si el pago ya no estaba en revisión (otro revisor ganó).
CREATE OR REPLACE FUNCTION approve_payment(p_payment_id uuid, p_reviewer uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_concept text;
  v_enrollment uuid;
BEGIN
  UPDATE payments
  SET review_status = 'aprobado', status = 'paid',
      reviewed_by = p_reviewer, reviewed_at = now(), paid_at = now()
  WHERE id = p_payment_id AND review_status = 'en_revision'
  RETURNING concept, enrollment_id INTO v_concept, v_enrollment;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Activar la matrícula EN LA MISMA transacción: pendiente_de_pago → enrolled.
  IF v_concept = 'matricula' AND v_enrollment IS NOT NULL THEN
    UPDATE study_enrollments SET status = 'enrolled'
    WHERE id = v_enrollment AND status = 'pendiente_de_pago';
  END IF;
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION approve_payment(uuid, uuid) FROM public, anon, authenticated;

-- ── close_group ───────────────────────────────────────────────────────────
-- Antes (app): claim 'finalizado' + N updates de inscripciones + insert de
-- recomendaciones, sin transacción — un fallo a mitad dejaba el grupo cerrado
-- con inscripciones a medias y el retry rebotaba con YA_CERRADO.
-- Devuelve false si el grupo ya estaba finalizado (doble POST).
-- Las recomendaciones son best-effort (un fallo ahí NO revierte el cierre),
-- igual que el comportamiento anterior de la app.
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
      WHERE group_id = p_group_id AND member_id = (r->>'member_id')::uuid;
    ELSE
      UPDATE study_enrollments
      SET status = 'completed', completed_at = v_now,
          grade = NULLIF(r->>'grade', '')::numeric,
          notes = CASE
            WHEN r->>'status_result' = 'reprobado' AND coalesce(trim(r->>'fail_reason'), '') <> ''
              THEN 'reprobado: ' || trim(r->>'fail_reason')
            ELSE r->>'status_result'
          END
      WHERE group_id = p_group_id AND member_id = (r->>'member_id')::uuid;
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
