-- FIN-1: la stat card "Sin identificar" se reemplaza por "Donadores activos".
-- Definición existente de donador activo: members.is_donor (flag recalculado
-- por refresh_donor_flags / trigger de donaciones — donó en los últimos ~2
-- trimestres). Acá SOLO se agrega el conteo al RPC; la definición no cambia.

CREATE OR REPLACE FUNCTION "public"."donation_stats"() RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'unique_donors',       (SELECT count(DISTINCT member_id) FROM donations WHERE is_identified AND member_id IS NOT NULL),
    'active_donors',       (SELECT count(*) FROM members WHERE is_donor),
    'total_this_month',    (SELECT COALESCE(sum(amount), 0) FROM donations
                              WHERE date_trunc('month', donation_date) = date_trunc('month', CURRENT_DATE)),
    'unidentified_count',  (SELECT count(*) FROM donations WHERE NOT is_identified),
    'unidentified_total',  (SELECT COALESCE(sum(amount), 0) FROM donations WHERE NOT is_identified)
  );
$$;
