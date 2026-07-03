-- Conteo de matrículas (folletos) de un bloque, desglosado por sede.
-- Asociación estudios↔bloque por RANGO DE FECHAS: un grupo de capacitación pertenece
-- al bloque si su fecha de inicio (starts_at) cae en la ventana del bloque
-- [apertura − 2 semanas, apertura + ~2.5 meses] (los bloques van cada ~4 meses, sin
-- solaparse). Capacitación = estudio que NO es Nivel 1-4 ni Discípulos 2-3.
-- Sede = la del perfil del dirigente del grupo (members.sede_id → sedes.name).
-- Cuenta inscripciones en estado 'enrolled' o 'pendiente_de_pago'.

CREATE OR REPLACE FUNCTION block_folletos_by_sede(p_apertura date)
RETURNS TABLE(sede text, cantidad bigint)
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(sd.name, 'Sin sede') AS sede, count(*)::bigint AS cantidad
  FROM study_enrollments e
  JOIN study_groups sg ON sg.id = e.group_id
  JOIN study_plans sp ON sp.id = sg.plan_id
  LEFT JOIN members lead ON lead.id = sg.leader_id
  LEFT JOIN sedes sd ON sd.id = lead.sede_id
  WHERE sp.code <> ALL (ARRAY['N1','N2','N3','N4','DIS2','DIS3'])
    AND sg.starts_at::date BETWEEN (p_apertura - interval '14 days') AND (p_apertura + interval '75 days')
    AND e.status IN ('enrolled','pendiente_de_pago')
  GROUP BY COALESCE(sd.name, 'Sin sede')
  ORDER BY cantidad DESC;
$$;
