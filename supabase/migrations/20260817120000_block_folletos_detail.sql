-- Desglose por grupo de los folletos de un bloque (misma asociación por rango
-- de fechas que block_folletos_by_sede, que se conserva para el conteo del
-- borrado de bloques). Alimenta el correo/notificación de hitos con grupo,
-- nivel y dirigente en vez de solo el total por sede.
CREATE OR REPLACE FUNCTION "public"."block_folletos_detail"("p_apertura" "date")
RETURNS TABLE("sede" "text", "grupo" "text", "nivel_code" "text", "nivel" "text", "dirigente" "text", "cantidad" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(sd.name, 'Sin sede') AS sede,
         sg.name AS grupo,
         sp.code AS nivel_code,
         sp.name AS nivel,
         COALESCE(NULLIF(btrim(concat(lead.first_name, ' ', lead.last_name)), ''), 'Sin dirigente') AS dirigente,
         count(*)::bigint AS cantidad
  FROM study_enrollments e
  JOIN study_groups sg ON sg.id = e.group_id
  JOIN study_plans sp ON sp.id = sg.plan_id
  LEFT JOIN members lead ON lead.id = sg.leader_id
  LEFT JOIN sedes sd ON sd.id = lead.sede_id
  WHERE sp.code <> ALL (ARRAY['N1','N2','N3','N4','DIS2','DIS3'])
    AND sg.starts_at::date BETWEEN (p_apertura - interval '14 days') AND (p_apertura + interval '75 days')
    AND e.status IN ('enrolled','pendiente_de_pago')
  GROUP BY 1, 2, 3, 4, 5
  ORDER BY 1, cantidad DESC;
$$;

ALTER FUNCTION "public"."block_folletos_detail"("p_apertura" "date") OWNER TO "postgres";
