-- A14 (auditoría BE 2026-07-13): submitResponse hacía 2 inserts sin
-- transacción — un fallo entre ambos dejaba una "respuesta fantasma" (cuenta
-- en los totales, vacía al abrirla). Ahora es atómico: o entra la respuesta
-- con todos sus valores, o no entra nada.
-- p_answers: objeto { field_id: valor } — string va a value_text; array o
-- número van a value_json (misma regla que tenía el TS).
CREATE OR REPLACE FUNCTION submit_form_response(
  p_form_id uuid,
  p_member_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_answers jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_response_id uuid;
  k text;
  v jsonb;
BEGIN
  INSERT INTO form_responses (form_id, member_id, guest_name, guest_email)
  VALUES (p_form_id, p_member_id, p_guest_name, p_guest_email)
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
END $$;
REVOKE EXECUTE ON FUNCTION submit_form_response(uuid, uuid, text, text, jsonb) FROM public, anon, authenticated;
