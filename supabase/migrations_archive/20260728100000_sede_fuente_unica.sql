-- REF-1: la regla de sede por asistencia queda con UNA sola fuente de
-- ejecución en producción: SQL. Este archivo contiene las DOS variantes
-- (por-miembro para el trigger, masiva para el pg_cron nocturno) — misma
-- regla, mismo archivo, misma revisión. El lado TS (computeMemberSede) queda
-- SOLO como especificación ejecutable de los fixtures (sin consumidores de
-- producción); los consumidores leen las columnas persistidas.
--
-- Regla (decisión 2026-07-15, sin cambios):
--  · Activo (asistió en los últimos 6 meses): sede = charla más asistida en
--    esos 6 meses; empate → la más reciente.
--  · Inactivo: sede = charla más asistida en los 6 meses previos a su última
--    asistencia.
--  · Sin asistencias reconocibles: sin sede.
--
-- BUGFIX incluido: el trigger recalc_member_sede() usaba la REGLA VIEJA
-- ("sede más frecuente de todo el historial", sin ventana ni caso) — cada
-- check-in escribía con esa regla y el cron de las 6:45 lo corregía de noche.
-- Ahora el trigger delega en refresh_member_sede(member_id).

CREATE OR REPLACE FUNCTION "public"."refresh_member_sede"(p_member_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_code text;
  v_active boolean;
  v_last timestamptz;
BEGIN
  -- Última asistencia a charla con sede reconocible.
  SELECT MAX(c.checked_in_at) INTO v_last
  FROM event_checkins c
  JOIN events e ON e.id = c.event_id
  WHERE c.member_id = p_member_id
    AND e.event_type = 'charla'
    AND charla_sede_code(e.title) IS NOT NULL;

  IF v_last IS NULL THEN
    UPDATE members SET sede_id = NULL, sede_case = NULL, sede_last_checkin = NULL
    WHERE id = p_member_id
      AND (sede_id IS NOT NULL OR sede_case IS NOT NULL OR sede_last_checkin IS NOT NULL);
    RETURN;
  END IF;

  v_active := v_last >= NOW() - INTERVAL '6 months';

  -- Charla más asistida en la ventana (empate → la más reciente). Mismo
  -- criterio que refresh_member_sedes() de abajo.
  SELECT charla_sede_code(e.title) INTO v_code
  FROM event_checkins c
  JOIN events e ON e.id = c.event_id
  WHERE c.member_id = p_member_id
    AND e.event_type = 'charla'
    AND charla_sede_code(e.title) IS NOT NULL
    AND CASE WHEN v_active
      THEN c.checked_in_at >= NOW() - INTERVAL '6 months'
      ELSE c.checked_in_at >= v_last - INTERVAL '6 months' AND c.checked_in_at <= v_last
    END
  GROUP BY charla_sede_code(e.title)
  ORDER BY COUNT(*) DESC, MAX(c.checked_in_at) DESC
  LIMIT 1;

  UPDATE members m
  SET sede_id = s.id,
      sede_case = CASE WHEN v_active THEN 'activo' ELSE 'inactivo' END,
      sede_last_checkin = v_last
  FROM sedes s
  WHERE m.id = p_member_id AND s.code = v_code;
END;
$$;

REVOKE ALL ON FUNCTION "public"."refresh_member_sede"(uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_member_sede"(uuid) TO "service_role";

-- El trigger por check-in delega en la función de arriba (adiós regla vieja).
CREATE OR REPLACE FUNCTION "public"."recalc_member_sede"() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.member_id IS NOT NULL THEN
    PERFORM refresh_member_sede(NEW.member_id);
  END IF;
  RETURN NEW;
END;
$$;
