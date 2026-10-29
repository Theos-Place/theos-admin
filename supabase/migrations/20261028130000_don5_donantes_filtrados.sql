-- DON-5 · Las tarjetas de Donaciones siguen a los filtros (Floriana, 2026-10-28).
--
-- «Donantes identificados» y «Total donado este mes» salían de donation_stats(),
-- que mira el padrón entero: con el rango de fecha puesto, la lista era de ese
-- rango y las tarjetas no. Esta función recibe los MISMOS filtros que la
-- lista (queries/finance.ts · getDonations) y devuelve cuántas personas
-- distintas identificadas donaron en lo filtrado y cuánto, por moneda.
-- Reemplaza también el cálculo de la suma filtrada que se hacía paginando
-- de a mil filas en Node. donation_stats() se queda para el caso sin filtros.
create or replace function public.donation_stats_filtrados(
  p_from          date default null,
  p_to            date default null,
  p_status        text default null,      -- 'identified' | 'unidentified' | null
  p_search_tokens text[] default null
) returns json
language sql stable security definer
set search_path to 'public'
as $$
  with f as (
    select d.member_id, d.is_identified, coalesce(d.currency, 'CRC') cur, d.amount
    from donations d
    left join members m on m.id = d.member_id
    where (p_from is null or d.donation_date >= p_from)
      and (p_to is null or d.donation_date <= p_to)
      and (p_status is null
           or (p_status = 'identified' and d.is_identified)
           or (p_status = 'unidentified' and not d.is_identified))
      and (p_search_tokens is null or cardinality(p_search_tokens) = 0
           or (m.search_text is not null and not exists (
                 select 1 from unnest(p_search_tokens) tok
                 where m.search_text not like '%' || tok || '%')))
  )
  select json_build_object(
    'unique_donors', (select count(distinct member_id) from f where is_identified and member_id is not null),
    'total', (select coalesce(json_object_agg(cur, monto), '{}'::json)
                from (select cur, sum(amount) monto from f group by 1) t)
  );
$$;

revoke execute on function public.donation_stats_filtrados(date, date, text, text[]) from public, anon, authenticated;
grant  execute on function public.donation_stats_filtrados(date, date, text, text[]) to service_role;
