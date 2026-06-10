-- 040: agregados del dashboard en SQL. Antes el server traía todas las filas
-- de payments / message_broadcasts / volunteers y sumaba en JS — O(n) en red
-- y memoria. Una sola RPC devuelve los tres valores ya agregados.

CREATE OR REPLACE FUNCTION dashboard_sums(p_month_start timestamptz, p_month_start_date date)
RETURNS TABLE (income_this_month numeric, total_recipients bigint, servers_unique bigint)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    COALESCE((SELECT SUM(amount)
              FROM public.payments
              WHERE status = 'paid' AND payment_date >= p_month_start_date), 0),
    COALESCE((SELECT SUM(total_recipients)
              FROM public.message_broadcasts
              WHERE created_at >= p_month_start), 0),
    COALESCE((SELECT COUNT(DISTINCT member_id)
              FROM public.volunteers
              WHERE status = 'active'), 0)
$$;
