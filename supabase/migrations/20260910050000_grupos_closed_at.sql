-- EVE-10: cuándo se cerró de verdad un grupo.
--
-- Los reportes de cierre se apoyaban en `updated_at`, que cambia con cualquier
-- edición: renombrar el grupo un mes después movía la fecha de cierre. Con una
-- columna propia, "qué se cerró el lunes" deja de ser una aproximación.
--
-- `closed_by` guarda quién lo cerró. Ya viajaba al RPC (p_closed_by) pero solo
-- se usaba para firmar las recomendaciones; no quedaba en el grupo.

ALTER TABLE public.study_groups
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES public.members(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.study_groups.closed_at IS
  'Momento del cierre. NULL en los grupos históricos importados de CCB, que no dejaron huella de cuándo se cerraron.';

CREATE INDEX IF NOT EXISTS study_groups_closed_at_idx
  ON public.study_groups (closed_at DESC) WHERE closed_at IS NOT NULL;

-- Backfill EXACTO, no aproximado: el cierre escribe completed_at/dropped_at en
-- las inscripciones con el mismo `now()` de la transacción, así que el máximo de
-- esas fechas ES el momento del cierre. Donde no hay huella (el histórico de
-- CCB) queda NULL a propósito: inventar una fecha sería peor que no tenerla.
UPDATE public.study_groups g
SET closed_at = h.cerrado
FROM (
  SELECT group_id, max(greatest(completed_at, dropped_at)) AS cerrado  -- GREATEST de Postgres ignora los NULL
  FROM public.study_enrollments
  WHERE completed_at IS NOT NULL OR dropped_at IS NOT NULL
  GROUP BY group_id
) h
WHERE g.id = h.group_id AND g.status = 'finalizado' AND g.closed_at IS NULL;

-- El RPC ahora sella la columna. El resto de la función no cambia.
CREATE OR REPLACE FUNCTION "public"."close_group"("p_group_id" "uuid", "p_results" "jsonb", "p_closed_by" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
