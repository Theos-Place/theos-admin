-- FIN-16 · Decisiones de Floriana del 2026-10-30.
--
-- 1. El SOBREGIRO pasa al mes siguiente: se resta de lo disponible (si
--    sobró, el mes siguiente se deposita menos; si se pasó, tiene menos).
--    `saldo_anterior` puede ser negativo.
-- 2. Cada tipo lo ve el ENCARGADO de esa área: comida → Coordinador Comida,
--    (el Encargado Logística ve TODOS los de su sede: eso vive en el código,
--    PUESTOS_QUE_VEN_TODO),
--    bienvenida → Coordinador Bienvenida. Los demás tipos quedan abiertos al
--    equipo con acceso hasta que se decida quién los lleva.
-- 3. El Coordinador Bienvenida de una sede recibe el acceso a Presupuestos
--    (rol colaborador_finanzas por puesto, igual que FIN-12).

alter table public.sede_advances drop constraint if exists sede_advances_saldo_anterior_check;

update public.sede_budget_types set puestos = array['coordinador comida'] where code = 'comida';
update public.sede_budget_types set puestos = array['coordinador bienvenida'] where code = 'bienvenida';

do $$
declare
  v record;
  v_otg int := 0;
begin
  for v in
    select distinct vol.member_id, sp.id as position_id
      from volunteers vol
      join service_positions sp on sp.id = vol.position_id and sp.is_active
      join areas a on a.id = sp.area_id and a.is_active and a.area_type = 'committee'
     where vol.status = 'active'
       and unaccent(lower(btrim(a.name))) like 'sede%'
       and regexp_replace(
             regexp_replace(unaccent(lower(btrim(sp.title))), '\y(de|del|la|el|los|las)\y', ' ', 'g'),
             '\s+', ' ', 'g') = 'coordinador bienvenida'
  loop
    perform public.grant_position_role(v.member_id, 'colaborador_finanzas', v.position_id);
    v_otg := v_otg + 1;
  end loop;
  raise notice 'FIN-16: colaborador_finanzas otorgado a % Coordinador(es) Bienvenida.', v_otg;
end $$;
