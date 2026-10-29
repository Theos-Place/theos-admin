-- PAG-7 · Los totales de la pantalla de pagos siguen a los filtros.
--
-- «Total cobrado» y «Pendientes» salían de payment_stats(), que suma TODA la
-- tabla: con el filtro de fecha puesto para conciliar un mes, la lista
-- mostraba ese mes y las tarjetas de arriba seguían diciendo el total
-- histórico (Floriana, 2026-10-28). Esta función recibe los MISMOS filtros
-- que la lista (queries/finance.ts · getPaymentsPage) y suma por moneda.
--
-- La búsqueda llega ya tokenizada —sin tildes, en minúsculas— y cada token
-- tiene que estar en members.search_text, igual que applyMemberSearch.
-- payment_stats() se queda: la usa el dashboard sin filtros.
create or replace function public.payment_stats_filtrados(
  p_search_tokens text[] default null,
  p_entity_type   text default null,
  p_method        text default null,
  p_status        text default null,
  p_currency      text default null,
  p_in_plan       boolean default false,
  p_paid_from     timestamptz default null,
  p_paid_to       timestamptz default null
) returns json
language sql stable security definer
set search_path to 'public'
as $$
  with t as (
    select coalesce(p.currency, 'CRC') cur, p.status, sum(p.amount) monto
    from payments p
    left join members m on m.id = p.member_id
    where (p_entity_type is null or p.entity_type = p_entity_type)
      and (p_method is null or p.payment_method = p_method)
      and (p_status is null or p.status = p_status)
      and (p_currency is null
           or (p_currency = 'CRC' and (p.currency = 'CRC' or p.currency is null))
           or p.currency = p_currency)
      and (not p_in_plan or p.payment_plan_id is not null)
      and (p_paid_from is null or p.paid_at >= p_paid_from)
      and (p_paid_to is null or p.paid_at <= p_paid_to)
      and (p_search_tokens is null or cardinality(p_search_tokens) = 0
           or (m.search_text is not null and not exists (
                 select 1 from unnest(p_search_tokens) tok
                 where m.search_text not like '%' || tok || '%')))
    group by 1, 2
  )
  select json_build_object(
    'total_paid',    (select coalesce(json_object_agg(cur, monto), '{}'::json) from t where status = 'paid'),
    'total_pending', (select coalesce(json_object_agg(cur, monto), '{}'::json) from t where status = 'pending')
  );
$$;

revoke execute on function public.payment_stats_filtrados(text[], text, text, text, text, boolean, timestamptz, timestamptz) from public, anon, authenticated;
grant  execute on function public.payment_stats_filtrados(text[], text, text, text, text, boolean, timestamptz, timestamptz) to service_role;
