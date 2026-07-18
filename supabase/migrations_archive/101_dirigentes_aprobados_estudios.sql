-- Regla de negocio: todo dirigente activo está aprobado para dar estudios
-- (la implicación es unidireccional — un no-dirigente también puede estar aprobado).
-- Activar un dirigente nunca prendía member_admin_data.approved_to_lead_studies, así
-- que 163 de 165 dirigentes activos salían con el toggle apagado. Backfill puntual.

INSERT INTO member_admin_data (member_id, approved_to_lead_studies, approved_to_lead_studies_at)
SELECT DISTINCT mr.member_id, true, now()
FROM member_roles mr
WHERE mr.role = 'dirigente' AND mr.is_active = true
ON CONFLICT (member_id) DO UPDATE
  SET approved_to_lead_studies = true,
      approved_to_lead_studies_at = COALESCE(member_admin_data.approved_to_lead_studies_at, now())
  WHERE member_admin_data.approved_to_lead_studies IS DISTINCT FROM true;
