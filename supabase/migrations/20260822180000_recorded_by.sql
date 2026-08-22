-- FRM-4 · Quién REGISTRÓ algo a nombre de otra persona.
--
-- EL HUECO QUE ESTO CIERRA, y ya estaba abierto en producción: cinco flujos
-- permiten que el staff actúe a nombre de un tercero (resolveTargetMemberId), y
-- NINGUNO guardaba quién lo hizo. Hoy un coordinador puede crear una solicitud de
-- estudio o matricular a alguien más, y en la fila solo queda el miembro: no hay
-- forma de saber que lo digitó otra persona. `reviewed_by` no sirve para esto —
-- es quien REVISÓ la solicitud, no quien la escribió.
--
-- CONVENCIÓN: `recorded_by` es NULL cuando la persona lo hizo ella misma. Solo se
-- escribe cuando el actor es distinto del miembro. Así "NOT NULL" significa
-- exactamente "esto lo registró el staff", que es la pregunta que se hace en la
-- pantalla, y no hay que comparar dos columnas para saberlo.
--
-- Mismo nombre en las cinco tablas a propósito: la ficha decía `submitted_by`
-- para formularios, pero cinco nombres distintos para el mismo concepto es lo que
-- después obliga a recordar cuál va en cada tabla.

ALTER TABLE public.form_responses    ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.study_requests    ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.finance_requests  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.study_enrollments ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.members(id) ON DELETE SET NULL;
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.members(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.form_responses.recorded_by IS
  'FRM-4: quién digitó la respuesta si NO fue la propia persona (staff registrando por teléfono o papel). NULL = la respondió quien figura en member_id.';
COMMENT ON COLUMN public.study_requests.recorded_by IS
  'FRM-4: quién creó la solicitud a nombre del miembro. NULL = la creó el propio miembro. Distinto de reviewed_by, que es quien la revisó.';
COMMENT ON COLUMN public.finance_requests.recorded_by IS
  'FRM-4: quién creó la solicitud a nombre del miembro. NULL = la creó el propio miembro.';
COMMENT ON COLUMN public.study_enrollments.recorded_by IS
  'FRM-4: quién matriculó al miembro, si no fue él mismo. NULL = se matriculó solo.';
COMMENT ON COLUMN public.event_registrations.recorded_by IS
  'FRM-4: quién inscribió al miembro, si no fue él mismo. NULL = se inscribió solo.';

-- Índices parciales: lo que se consulta es "¿qué registró el staff?", que son
-- pocas filas sobre tablas grandes.
CREATE INDEX IF NOT EXISTS idx_form_responses_recorded_by
  ON public.form_responses (recorded_by) WHERE recorded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_enrollments_recorded_by
  ON public.study_enrollments (recorded_by) WHERE recorded_by IS NOT NULL;

-- ── El RPC de respuestas: un parámetro más, con default ──────────────────────
-- La firma es fija, así que hay que reemplazar la función. El default NULL deja
-- funcionando cualquier llamada de 5 argumentos que ya exista.
DROP FUNCTION IF EXISTS public.submit_form_response(uuid, uuid, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.submit_form_response(
  p_form_id uuid,
  p_member_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_answers jsonb,
  p_recorded_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_response_id uuid;
  k text;
  v jsonb;
BEGIN
  INSERT INTO form_responses (form_id, member_id, guest_name, guest_email, recorded_by)
  VALUES (p_form_id, p_member_id, p_guest_name, p_guest_email, p_recorded_by)
  RETURNING id INTO v_response_id;

  FOR k, v IN SELECT key, value FROM jsonb_each(coalesce(p_answers, '{}'::jsonb)) LOOP
    INSERT INTO form_response_values (response_id, field_id, value_text, value_json)
    VALUES (
      v_response_id,
      k::uuid,
      CASE WHEN jsonb_typeof(v) = 'string' THEN v #>> '{}' ELSE NULL END,
      CASE WHEN jsonb_typeof(v) <> 'string' THEN v ELSE NULL END
    );
  END LOOP;

  RETURN v_response_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.submit_form_response(uuid, uuid, text, text, jsonb, uuid)
  TO authenticated, service_role;
