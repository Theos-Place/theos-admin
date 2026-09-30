-- Director de Área · el puesto que está por encima de los comités.
--
-- Pedido de Floriana, 2026-09-30. NO se agrega una columna a `areas`: el
-- director es un PUESTO colgado del área, que es lo que ella pidió («es un
-- puesto más, solo que está por encima de los comités») y lo que evita
-- repetir el error de `areas.leader_id` — 12 comités lo tenían, 2 apuntaban a
-- otra persona distinta de la del puesto, y SRV-5 lo declaró muerto.
--
-- MEDIDO ANTES (producción, 2026-09-30):
--   · SEIS áreas ya tenían un puesto «Director» con gente asignada:
--     Comunidad (Debbie Sasso), Enseñanza (Luis Guillermo Alonso + Maria
--     Adelia Piza), Espiritual (Benjamin Sasso), Finanzas (Melissa Acon),
--     Operaciones (Santiago Alvarez) y Staff (Lucia Porras).
--   · DOS áreas no lo tenían: Area Dirección y Area Sedes.
--   · «Director Ejecutivo» y «Director General» existen, pero en el COMITÉ
--     «Directores» (3 personas). Son otro cargo y esta migración NO los toca:
--     el WHERE exige `area_type = 'area'` y el título exacto.
--
-- Área Enseñanza queda con DOS directores y está bien (confirmado por
-- Floriana). Por eso nada de esto asume uno solo.

begin;

-- 1) El nombre oficial. Antes eran «Director» a secas, que en una pantalla
--    junto a «Director General» no se distingue.
update public.service_positions sp
   set title = 'Director de Área'
  from public.areas a
 where a.id = sp.area_id
   and a.area_type = 'area'
   and lower(btrim(sp.title)) = 'director';

-- 2) Las dos áreas que no lo tenían. Se crea VACÍO —sin asignar a nadie—:
--    quién dirige Dirección y Sedes no es una decisión que pueda tomar una
--    migración, y un puesto vacío se ve en la pantalla y pide que lo llenen.
insert into public.service_positions (area_id, title, quantity, is_active)
select a.id, 'Director de Área', 1, true
  from public.areas a
 where a.area_type = 'area'
   and a.is_active
   and not exists (
     select 1 from public.service_positions sp
      where sp.area_id = a.id
        and sp.is_active
        and lower(btrim(sp.title)) in ('director', 'director de área', 'director de area', 'director área', 'director area')
   );

-- 3) EL ROL `reportes` PARA QUIENES YA TIENEN EL PUESTO.
--
-- Sin esto la regla nueva de `position-roles` no le llega a nadie: el sync
-- corre cuando alguien TOCA una asignación, y los 7 directores de hoy ya la
-- tienen desde antes. Se descubrió probándolo en staging —«Mi comité» le
-- abría los 7 comités de su área y los reportes le daban 403—, no leyendo el
-- código.
--
-- Se llama al RPC en vez de insertar: `grant_position_role` ya es idempotente,
-- ya respeta un rol que la persona tenga a mano (no le pisa el `origen`) y ya
-- crea la fila de `member_role_position_grants`, que es lo que hace que al
-- dejar de ser director pierda el acceso.
--
-- De los 7 de hoy, 2 ya veían todo por `direccion`, 1 tenía `reportes` y 1 el
-- módulo por `coordinador_servidores`; los que ganan acceso son Maria Adelia
-- Piza, Melissa Acon Chaves y Santiago Alvarez Ovares.
do $$
declare v record; v_n int := 0;
begin
  for v in
    select distinct vol.member_id, sp.id as position_id
      from public.volunteers vol
      join public.service_positions sp on sp.id = vol.position_id and sp.is_active
      join public.areas a on a.id = sp.area_id and a.is_active and a.area_type = 'area'
     where vol.status = 'active'
       and lower(btrim(sp.title)) in ('director', 'director de área', 'director de area')
  loop
    perform public.grant_position_role(v.member_id, 'reportes', v.position_id);
    v_n := v_n + 1;
  end loop;
  raise notice 'Director de Área: rol reportes otorgado a % persona(s).', v_n;
end $$;

commit;
