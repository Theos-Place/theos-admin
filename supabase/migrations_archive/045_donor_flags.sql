-- 045: donador activo = donó en los últimos 150 días.
-- members.is_donor pasa a ser un flag derivado de donations:
--   1) refresh_donor_flags() lo recalcula completo (cron diario via pg_cron).
--   2) Un trigger en donations lo enciende al instante al insertar.
-- Lo consumen: chip Donadores en miembros, dashboard (donors_active) y los
-- requisitos de compromiso del análisis de demanda de estudios.

CREATE OR REPLACE FUNCTION refresh_donor_flags(p_days INT DEFAULT 150)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE members m
  SET is_donor = calc.flag
  FROM (
    SELECT m2.id,
           EXISTS (
             SELECT 1 FROM donations d
             WHERE d.member_id = m2.id
               AND d.donation_date >= CURRENT_DATE - p_days
           ) AS flag
    FROM members m2
  ) calc
  WHERE calc.id = m.id
    AND m.is_donor IS DISTINCT FROM calc.flag;
$$;

-- Donación nueva dentro de la ventana → donador activo inmediato.
CREATE OR REPLACE FUNCTION set_donor_on_donation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.member_id IS NOT NULL AND NEW.donation_date >= CURRENT_DATE - 150 THEN
    UPDATE members SET is_donor = TRUE
    WHERE id = NEW.member_id AND is_donor IS DISTINCT FROM TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_donations_donor ON donations;
CREATE TRIGGER trg_donations_donor
  AFTER INSERT ON donations
  FOR EACH ROW EXECUTE FUNCTION set_donor_on_donation();

-- Cron diario (6:30 UTC) para expirar a quienes salieron de la ventana.
-- Si pg_cron no está habilitado en el proyecto, la migración no falla:
-- queda el aviso y se programa desde el Dashboard (Database → Extensions).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('refresh-donor-flags', '30 6 * * *', 'SELECT refresh_donor_flags()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron no disponible (%) — programar refresh_donor_flags() manualmente', SQLERRM;
END;
$$;

-- Cálculo inicial con los datos ya importados.
SELECT refresh_donor_flags();
