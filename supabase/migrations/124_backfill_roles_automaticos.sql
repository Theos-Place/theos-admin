-- Migración de datos: otorga los roles automáticos (encargado_eventos,
-- lider_comite) a quienes YA ocupan hoy un puesto mapeado (activo). Usa los
-- mismos RPCs que el flujo en vivo (grant_position_role) — idempotente, y si
-- alguien ya tenía el rol manual no cambia su origen, solo registra el
-- respaldo del puesto. Mapeo exacto: ver src/lib/servers/position-roles.ts.
DO $$
DECLARE
  rec record;
  n int := 0;
BEGIN
  FOR rec IN
    SELECT v.member_id, sp.id AS position_id, 'lider_comite' AS role
    FROM volunteers v
    JOIN service_positions sp ON sp.id = v.position_id
    JOIN areas a ON a.id = sp.area_id AND a.area_type = 'committee'
    WHERE v.status = 'active'
      AND lower(trim(sp.title)) IN ('encargado', 'encargado de comité', 'encargado de comite')

    UNION ALL

    SELECT v.member_id, sp.id AS position_id, 'encargado_eventos' AS role
    FROM volunteers v
    JOIN service_positions sp ON sp.id = v.position_id
    JOIN areas a ON a.id = sp.area_id AND a.area_type = 'committee'
    JOIN areas pa ON pa.id = a.parent_id
    WHERE v.status = 'active'
      AND lower(trim(pa.name)) = lower('Área Espiritual')
      AND lower(trim(sp.title)) IN (
        'logística', 'colaborador bienvenida', 'colaborador de bienvenida',
        'coordinador bienvenida', 'coordinador información'
      )
  LOOP
    PERFORM grant_position_role(rec.member_id, rec.role, rec.position_id);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Grants de puesto→rol procesados: %', n;
END $$;
