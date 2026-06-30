-- 5b: aprobar la aplicación de una persona la activa como servidor del puesto/comité
-- de la vacante, en una SOLA transacción (función plpgsql atómica). Sirve para
-- aprobación individual (array de 1) y en lote (varias). No dispara correos.
--
-- Reglas:
--  · Resuelve puesto desde la aplicación → vacante → position_id.
--  · Si no hay volunteer en ese puesto → lo crea activo (start_date = hoy).
--  · Si existe inactivo/on_leave/pending → lo reactiva (status='active', end_date=null).
--  · Si ya estaba activo → no duplica ni recuenta.
--  · Incrementa vacancies.slots_filled solo cuando realmente activa a alguien.
--  · Ignora aplicaciones ya aprobadas (evita doble conteo / doble incremento).
-- Devuelve la cantidad de servidores efectivamente activados.

CREATE OR REPLACE FUNCTION approve_applications(app_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  rec record;
  existing_status text;
  activated integer := 0;
BEGIN
  FOR rec IN
    SELECT a.id AS app_id, a.applicant_id, v.id AS vacancy_id,
           v.position_id, COALESCE(v.slots_filled, 0) AS slots_filled
    FROM applications a
    JOIN vacancies v ON v.id = a.vacancy_id
    WHERE a.id = ANY(app_ids) AND a.status IS DISTINCT FROM 'approved'
  LOOP
    UPDATE applications SET status = 'approved', updated_at = now() WHERE id = rec.app_id;

    IF rec.position_id IS NOT NULL THEN
      SELECT status INTO existing_status
      FROM volunteers
      WHERE member_id = rec.applicant_id AND position_id = rec.position_id;

      IF existing_status IS NULL THEN
        INSERT INTO volunteers (member_id, position_id, status, start_date)
        VALUES (rec.applicant_id, rec.position_id, 'active', current_date);
        activated := activated + 1;
        UPDATE vacancies SET slots_filled = rec.slots_filled + 1 WHERE id = rec.vacancy_id;
      ELSIF existing_status <> 'active' THEN
        UPDATE volunteers SET status = 'active', end_date = NULL
        WHERE member_id = rec.applicant_id AND position_id = rec.position_id;
        activated := activated + 1;
        UPDATE vacancies SET slots_filled = rec.slots_filled + 1 WHERE id = rec.vacancy_id;
      END IF;
    END IF;
  END LOOP;

  RETURN activated;
END;
$$;
