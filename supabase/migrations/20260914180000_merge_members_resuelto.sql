-- Fusión de duplicados con la resolución campo por campo, en UNA transacción.
--
-- QUÉ FALTABA. merge_members fusiona los campos con coalesce(principal,
-- duplicado): rellena los huecos del principal, pero cuando los dos tienen
-- valor se queda con el del principal sin preguntar. Así se perdió el segundo
-- apellido de Zully Murillo Sanchez — "Murillo" le ganó a "Murillo Sanchez".
--
-- La app ya tenía una pantalla campo por campo, pero aplicaba lo elegido en un
-- UPDATE aparte DESPUÉS del RPC, fuera de transacción y marcado en el código
-- como "cosmético": si ese update fallaba, la fusión ya había ocurrido y los
-- valores elegidos se perdían sin que nadie se enterara.
--
-- Acá va todo junto: se guarda la foto del duplicado, se aplican los valores
-- elegidos al principal, y recién entonces se fusiona. Si algo falla, no pasó
-- nada.
--
-- SIEMPRE SUAVE. El duplicado queda inactivo marcado como 'merged', nunca se
-- borra: con borrado duro la fila desaparece y la bitácora guardaba new_data
-- NULL, así que el perfil descartado se evaporaba. Ahora hay dos redes — la
-- foto en la bitácora y la fila inactiva.

-- Rastro de los external_id que se fusionaron en esta ficha.
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS external_id_fusionados text[];
COMMENT ON COLUMN public.members.external_id_fusionados IS
  'external_id de las fichas que se fusionaron acá. Un import de CCB puede traer cualquiera de ellos y debe resolver a esta ficha.';

CREATE OR REPLACE FUNCTION public.merge_members_resuelto(
  p_keep_id uuid,
  p_dup_id uuid,
  p_resueltos jsonb DEFAULT '{}'::jsonb,
  p_actor uuid DEFAULT NULL
) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_dup      jsonb;
  v_keep     jsonb;
  v_cols     text;
  v_key      text;
  v_val      text;
  v_tipo     text;
  v_dup_auth uuid;
  v_dup_mail text;
BEGIN
  IF p_keep_id = p_dup_id THEN RAISE EXCEPTION 'No se puede fusionar un miembro consigo mismo'; END IF;
  SELECT to_jsonb(m) INTO v_keep FROM members m WHERE m.id = p_keep_id;
  SELECT to_jsonb(m) INTO v_dup  FROM members m WHERE m.id = p_dup_id;
  IF v_keep IS NULL THEN RAISE EXCEPTION 'Miembro a conservar no existe'; END IF;
  IF v_dup  IS NULL THEN RAISE EXCEPTION 'Miembro duplicado no existe'; END IF;

  v_dup_auth := (v_dup->>'auth_user_id')::uuid;
  v_dup_mail := v_dup->>'email';

  -- La cédula y el correo elegidos no pueden ser de un TERCERO. El duplicado no
  -- cuenta: su fila se va a desactivar en esta misma transacción.
  IF p_resueltos ? 'cedula' AND nullif(trim(p_resueltos->>'cedula'), '') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM members m WHERE m.id NOT IN (p_keep_id, p_dup_id)
                 AND m.is_active AND m.cedula = p_resueltos->>'cedula') THEN
      RAISE EXCEPTION 'CEDULA_DE_UN_TERCERO:%', p_resueltos->>'cedula';
    END IF;
  END IF;
  IF p_resueltos ? 'email' AND nullif(trim(p_resueltos->>'email'), '') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM members m WHERE m.id NOT IN (p_keep_id, p_dup_id)
                 AND m.is_active AND lower(m.email) = lower(p_resueltos->>'email')) THEN
      RAISE EXCEPTION 'CORREO_DE_UN_TERCERO:%', p_resueltos->>'email';
    END IF;
  END IF;

  -- La fusión de siempre: relaciones, tablas 1-a-1 y el resto. SIEMPRE soft.
  --
  -- VA ANTES de aplicar lo elegido, y no por gusto: hay un índice único
  -- (document_type, cedula_normalized), así que si el principal se queda con la
  -- cédula del duplicado mientras el duplicado todavía la tiene, revienta con
  -- 23505. merge_members le pone cedula y auth_user_id en NULL al duplicado, y
  -- recién ahí la cédula queda libre.
  --
  -- Que corra antes no rompe la resolución: merge_members rellena huecos con
  -- coalesce y los valores elegidos se escriben DESPUÉS, encima. Y sigue siendo
  -- una sola transacción, que es lo que importaba.
  PERFORM merge_members(p_keep_id, p_dup_id, true);

  -- Los valores elegidos, al principal. Se arma el SET solo con claves que son
  -- columnas reales de members: lo que venga de más se ignora en vez de
  -- reventar la fusión.
  SELECT string_agg(format('%I = ($1->>%L)::%s', c.column_name, c.column_name, c.udt_name), ', ')
    INTO v_cols
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'members'
     AND p_resueltos ? c.column_name
     AND c.column_name NOT IN ('id','created_at','updated_at','auth_user_id','external_id',
                               'is_active','deactivation_reason','deactivated_at','deactivated_by');
  IF v_cols IS NOT NULL THEN
    EXECUTE format('UPDATE members SET %s, updated_at = now() WHERE id = $2', v_cols)
      USING p_resueltos, p_keep_id;
  END IF;

  -- external_id del duplicado: se conserva el del principal, pero el otro queda
  -- anotado. Un import futuro de CCB puede traer cualquiera de los dos y tiene
  -- que poder resolver a esta ficha.
  IF v_dup->>'external_id' IS NOT NULL
     AND coalesce(v_keep->>'external_id', '') <> (v_dup->>'external_id') THEN
    UPDATE members SET external_id_fusionados =
      (SELECT array_agg(DISTINCT x) FROM unnest(
         coalesce(external_id_fusionados, ARRAY[]::text[]) || ARRAY[v_dup->>'external_id']) x)
     WHERE id = p_keep_id;
  END IF;

  -- La foto de lo que se descartó. Va DENTRO de la transacción: si la fusión se
  -- cae, tampoco queda una bitácora de algo que no pasó.
  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (p_actor, 'MERGE', 'members', p_keep_id, v_dup,
          jsonb_build_object('duplicate_id', p_dup_id, 'soft', true,
                             'resueltos', p_resueltos, 'principal_antes', v_keep));

  RETURN jsonb_build_object('dup_auth_user_id', v_dup_auth, 'dup_email', v_dup_mail);
END;
$$;

ALTER FUNCTION public.merge_members_resuelto(uuid, uuid, jsonb, uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.merge_members_resuelto(uuid, uuid, jsonb, uuid) TO anon, authenticated, service_role;

