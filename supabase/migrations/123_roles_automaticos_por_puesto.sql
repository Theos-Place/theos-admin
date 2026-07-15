-- Roles automáticos otorgados por puesto de servicio (encargado_eventos,
-- lider_comite). Distingue roles manuales (asignados a mano en /accesos) de
-- automáticos (respaldados por uno o más puestos activos) y permite saber
-- cuántos puestos respaldan un mismo rol de una persona.

ALTER TABLE member_roles
  ADD COLUMN origen TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'automatico'));

-- Respaldo puesto→rol: qué puesto le otorgó qué rol a quién. Varias filas para
-- (member_id, role) = varios puestos respaldando el mismo rol.
CREATE TABLE member_role_position_grants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  position_id UUID NOT NULL REFERENCES service_positions(id) ON DELETE CASCADE,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, role, position_id)
);
CREATE INDEX idx_role_grants_member_role ON member_role_position_grants(member_id, role);
CREATE INDEX idx_role_grants_position ON member_role_position_grants(position_id);

ALTER TABLE member_role_position_grants ENABLE ROW LEVEL SECURITY;
-- Sin policies (mismo patrón que scholarship_redemptions): solo service role,
-- la UI nunca lee/escribe esta tabla directamente.

-- Otorga el respaldo de un puesto sobre un rol (idempotente) y activa/reactiva
-- el rol si hiciera falta. Si el rol ya está activo (manual o automático), no
-- lo toca — solo registra el respaldo adicional. Transaccional (una función =
-- una transacción implícita).
CREATE OR REPLACE FUNCTION grant_position_role(p_member_id uuid, p_role text, p_position_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO member_role_position_grants (member_id, role, position_id)
  VALUES (p_member_id, p_role, p_position_id)
  ON CONFLICT (member_id, role, position_id) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM member_roles WHERE member_id = p_member_id AND role = p_role AND is_active
  ) THEN
    RETURN; -- ya activo (manual o automático) — no duplicar ni cambiar origen
  END IF;

  IF EXISTS (SELECT 1 FROM member_roles WHERE member_id = p_member_id AND role = p_role) THEN
    UPDATE member_roles
    SET is_active = true, origen = 'automatico', revoked_at = NULL, revoked_by = NULL, granted_at = now()
    WHERE member_id = p_member_id AND role = p_role;
  ELSE
    INSERT INTO member_roles (member_id, role, origen, is_active)
    VALUES (p_member_id, p_role, 'automatico', true);
  END IF;
END;
$$;

-- Quita el respaldo de un puesto sobre un rol. Si no queda ningún otro puesto
-- respaldándolo Y el rol es automático, lo desactiva. Un rol manual, o uno con
-- al menos otro puesto vigente, nunca se toca acá.
CREATE OR REPLACE FUNCTION revoke_position_role(p_member_id uuid, p_role text, p_position_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  remaining int;
  current_origen text;
BEGIN
  DELETE FROM member_role_position_grants
  WHERE member_id = p_member_id AND role = p_role AND position_id = p_position_id;

  SELECT count(*) INTO remaining FROM member_role_position_grants
  WHERE member_id = p_member_id AND role = p_role;
  IF remaining > 0 THEN RETURN; END IF;

  SELECT origen INTO current_origen FROM member_roles
  WHERE member_id = p_member_id AND role = p_role AND is_active;
  IF current_origen IS DISTINCT FROM 'automatico' THEN
    RETURN; -- manual, o ya no estaba activo: no tocar
  END IF;

  UPDATE member_roles SET is_active = false, revoked_at = now()
  WHERE member_id = p_member_id AND role = p_role AND is_active;
END;
$$;

REVOKE EXECUTE ON FUNCTION grant_position_role(uuid, text, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION revoke_position_role(uuid, text, uuid) FROM public, anon, authenticated;
