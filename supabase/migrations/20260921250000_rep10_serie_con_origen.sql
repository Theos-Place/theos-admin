-- REP-10 · La serie de personas nuevas ahora dice POR DÓNDE entró cada quien.
--
-- Sin esto, el filtro de charla/sede solo podía aplicarse a la tabla de
-- detalle: los gráficos se armaban con un agregado que no tenía esa dimensión,
-- así que al filtrar cambiaba la tabla y los gráficos se quedaban igual —
-- mostrando dos universos distintos en la misma pantalla.
--
-- Sigue siendo un agregado chico: una fila por (año, mes, canal, origen).
drop function if exists public.report_personas_nuevas_series();

create function public.report_personas_nuevas_series()
returns table (anio integer, mes integer, canal text, origen text, n bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select extract(year from p.fecha)::int,
         extract(month from p.fecha)::int,
         p.canal,
         p.origen,
         count(*)::bigint
  from primera_actividad_por_miembro() p
  group by 1, 2, 3, 4
$$;

revoke execute on function public.report_personas_nuevas_series() from public, anon, authenticated;
grant  execute on function public.report_personas_nuevas_series() to service_role;
