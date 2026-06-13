-- 058: Stats de donaciones en SQL (para paginar el listado sin perder los
-- totales que la página calcula sobre TODO el conjunto). Espejo del patrón de
-- dashboard_sums. Los montos se exponen/ocultan por rol en la capa API.

CREATE OR REPLACE FUNCTION donation_stats()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT json_build_object(
    'unique_donors',       (SELECT count(DISTINCT member_id) FROM donations WHERE is_identified AND member_id IS NOT NULL),
    'total_this_month',    (SELECT COALESCE(sum(amount), 0) FROM donations
                              WHERE date_trunc('month', donation_date) = date_trunc('month', CURRENT_DATE)),
    'unidentified_count',  (SELECT count(*) FROM donations WHERE NOT is_identified),
    'unidentified_total',  (SELECT COALESCE(sum(amount), 0) FROM donations WHERE NOT is_identified)
  );
$$;
