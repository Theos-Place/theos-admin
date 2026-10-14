-- FIN-12 · El adelanto de comida lo administran el Encargado Logística y el
-- Coordinador Comida de cada sede, no el «Colaborador Finanzas».
--
-- Decisión de Floriana (2026-10-14): «solamente el encargado de logística y
-- el encargado de comida (puestos), además de finanzas, admin y dirección».
-- El catálogo no tiene «Encargado Comida»: el puesto real es «Coordinador
-- Comida». La regla nueva vive en `lib/servers/position-roles.ts`
-- (TITULOS_DE_ADELANTOS) y funciona sola de ahora en adelante.
--
-- Esta migración existe por el BACKFILL, igual que la de REP-12: el sync por
-- puesto corre cuando alguien TOCA una asignación, así que a quien ya tiene
-- el puesto la regla no le llega sola. Dos movimientos:
--
--  1. REVOCAR lo que dio el puesto «Colaborador Finanzas» (origen puesto).
--     Se usa `revoke_position_role`, que respeta un rol dado a mano.
--  2. OTORGAR a los Encargado Logística / Coordinador Comida activos en
--     comités de sede, con `grant_position_role` (idempotente, crea la fila
--     de `member_role_position_grants` que hace que al perder el puesto se
--     pierda el acceso).
--
-- El espejo SQL de `normSinArticulos`: sin acentos, sin artículos, espacios
-- colapsados. Comité de sede = área tipo committee cuyo nombre empieza por
-- «sede» (mismo criterio que `esComiteDeSede`).

begin;

do $$
declare
  v record;
  v_rev int := 0;
  v_otg int := 0;
begin
  -- 1. Revocar lo que daba el puesto viejo.
  for v in
    select distinct g.member_id, g.position_id
      from member_role_position_grants g
      join service_positions sp on sp.id = g.position_id
     where g.role = 'colaborador_finanzas'
       and regexp_replace(
             regexp_replace(unaccent(lower(btrim(sp.title))), '\y(de|del|la|el|los|las)\y', ' ', 'g'),
             '\s+', ' ', 'g') = 'colaborador finanzas'
  loop
    perform public.revoke_position_role(v.member_id, 'colaborador_finanzas', v.position_id);
    v_rev := v_rev + 1;
  end loop;

  -- 2. Otorgar por los puestos nuevos.
  for v in
    select distinct vol.member_id, sp.id as position_id
      from volunteers vol
      join service_positions sp on sp.id = vol.position_id and sp.is_active
      join areas a on a.id = sp.area_id and a.is_active and a.area_type = 'committee'
     where vol.status = 'active'
       and unaccent(lower(btrim(a.name))) like 'sede%'
       and regexp_replace(
             regexp_replace(unaccent(lower(btrim(sp.title))), '\y(de|del|la|el|los|las)\y', ' ', 'g'),
             '\s+', ' ', 'g') in ('encargado logistica', 'coordinador comida')
  loop
    perform public.grant_position_role(v.member_id, 'colaborador_finanzas', v.position_id);
    v_otg := v_otg + 1;
  end loop;

  raise notice 'FIN-12: revocados % (Colaborador Finanzas), otorgados % (Encargado Logistica / Coordinador Comida).', v_rev, v_otg;
end $$;

commit;
