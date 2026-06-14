-- 060: Totales globales de pagos en SQL (para paginar el listado sin perder los
-- totales que la página calcula sobre TODO el conjunto). Espejo de donation_stats.
-- Los montos se exponen/ocultan por rol en la capa de UI (AmountDisplay).

CREATE OR REPLACE FUNCTION payment_stats()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT json_build_object(
    'total_paid',    (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'paid'),
    'total_card',    (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'paid' AND payment_method = 'card'),
    'total_sinpe',   (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'paid' AND payment_method = 'sinpe'),
    'total_pending', (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'pending')
  );
$$;
