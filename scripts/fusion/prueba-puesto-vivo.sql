-- Prueba de la fusión contra una base de verdad. NO escribe nada: la
-- transacción termina en `rollback` pase lo que pase.
--
--   node scripts/staging/aplicar-sql.mjs scripts/fusion/prueba-puesto-vivo.sql
--
-- Existe porque este bug no se ve en un test de TypeScript: vive dentro de una
-- función de plpgsql de 190 líneas, y lo que falla es el ORDEN de los
-- borrados. La primera versión del arreglo rescataba el puesto y perdía el
-- rol —el rescate de roles había quedado DESPUÉS del borrado de roles—, y eso
-- lo encontró esta prueba, no la lectura.
--
-- Falla con un `raise exception`, así que el runner sale con error.
-- Escenario exacto de Silvia, en una transacción que SIEMPRE revierte.
begin;
do $$
declare
  v_keep uuid; v_dup uuid; v_pos uuid;
  v_status text; v_inicio date; v_filas int; v_rol boolean;
begin
  select id into v_pos from service_positions limit 1;

  insert into members (first_name, last_name, is_active)
    values ('ZZPrueba','Principal', true) returning id into v_keep;
  insert into members (first_name, last_name, is_active)
    values ('ZZPrueba','Duplicada', true) returning id into v_dup;

  -- La principal: puesto TERMINADO. La duplicada: el MISMO puesto, VIVO.
  insert into volunteers (member_id, position_id, status, start_date, end_date)
    values (v_keep, v_pos, 'inactive', '2026-01-01', '2026-09-12');
  insert into volunteers (member_id, position_id, status, start_date)
    values (v_dup,  v_pos, 'active',   '2026-09-11');

  -- Y un rol a mano: revocado en la principal, activo en la duplicada.
  insert into member_roles (member_id, role, is_active, origen)
    values (v_keep, 'encargado_eventos', false, 'manual');
  insert into member_roles (member_id, role, is_active, origen)
    values (v_dup,  'encargado_eventos', true,  'manual');

  perform merge_members(v_keep, v_dup, true);

  select count(*) into v_filas from volunteers where member_id = v_keep;
  select status, start_date into v_status, v_inicio
    from volunteers where member_id = v_keep and position_id = v_pos;
  select is_active into v_rol
    from member_roles where member_id = v_keep and role = 'encargado_eventos';

  raise notice 'filas de puesto: %  (esperado 1)', v_filas;
  raise notice 'estado: %  (esperado active)', v_status;
  raise notice 'inicio: %  (esperado 2026-09-11)', v_inicio;
  raise notice 'rol activo: %  (esperado t)', v_rol;

  if v_status <> 'active' then raise exception 'FALLA: el puesto quedó %', v_status; end if;
  if v_inicio <> date '2026-09-11' then raise exception 'FALLA: inicio %', v_inicio; end if;
  if not v_rol then raise exception 'FALLA: el rol quedó revocado'; end if;
  raise notice '✓ la fusión conservó el puesto vivo y el rol';
end $$;
rollback;
