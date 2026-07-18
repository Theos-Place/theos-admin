-- 046: criterio de donador activo confirmado por dirección — donó en el
-- trimestre ACTUAL o en los 2 trimestres anteriores (trimestres calendario,
-- que coinciden con los bloques de donación Ene-Mar / Abr-Jun / Jul-Set /
-- Oct-Dic). Reemplaza la ventana de 150 días de la 045, que con fechas
-- ancladas al inicio del trimestre dejaba fuera trimestres completos.

-- La firma cambia (ya no recibe días): borrar la versión anterior para no
-- dejar una sobrecarga huérfana.
DROP FUNCTION IF EXISTS refresh_donor_flags(INT);

CREATE OR REPLACE FUNCTION refresh_donor_flags()
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
               -- inicio del trimestre que está 2 trimestres atrás del actual
               AND d.donation_date >= (date_trunc('quarter', CURRENT_DATE) - INTERVAL '6 months')::date
           ) AS flag
    FROM members m2
  ) calc
  WHERE calc.id = m.id
    AND m.is_donor IS DISTINCT FROM calc.flag;
$$;

-- Trigger: misma ventana de trimestres.
CREATE OR REPLACE FUNCTION set_donor_on_donation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.member_id IS NOT NULL
     AND NEW.donation_date >= (date_trunc('quarter', CURRENT_DATE) - INTERVAL '6 months')::date THEN
    UPDATE members SET is_donor = TRUE
    WHERE id = NEW.member_id AND is_donor IS DISTINCT FROM TRUE;
  END IF;
  RETURN NEW;
END;
$$;

-- El cron de la 045 ('SELECT refresh_donor_flags()') resuelve a la nueva
-- función sin cambios. Recalcular ya con el criterio nuevo:
SELECT refresh_donor_flags();
