-- 025: la sede del miembro se calcula por asistencia a eventos tipo 'charla'
-- (no por cualquier evento con sede). Mantiene search_path pinneado (lint 0011).

CREATE OR REPLACE FUNCTION recalc_member_sede()
RETURNS TRIGGER
SET search_path = public
AS $$
DECLARE
  v_sede_id UUID;
  v_member_id UUID;
BEGIN
  v_member_id := NEW.member_id;

  -- Sólo recalculamos para miembros (no para invitados)
  IF v_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sede más frecuente entre check-ins del miembro a CHARLAS con sede definida
  SELECT e.sede_id INTO v_sede_id
  FROM event_checkins ec
  JOIN events e ON e.id = ec.event_id
  WHERE ec.member_id = v_member_id
    AND e.sede_id IS NOT NULL
    AND e.event_type = 'charla'
  GROUP BY e.sede_id
  ORDER BY COUNT(*) DESC, MAX(ec.checked_in_at) DESC
  LIMIT 1;

  UPDATE members SET sede_id = v_sede_id WHERE id = v_member_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
