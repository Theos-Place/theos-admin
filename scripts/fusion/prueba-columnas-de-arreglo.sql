-- Fusionar una ficha que YA absorbió a otra. Revierte siempre.
--   node scripts/staging/aplicar-sql.mjs scripts/fusion/prueba-columnas-de-arreglo.sql
--
-- Caso de Silvia Jiménez (2026-09-30): la duplicada traía
-- `external_id_fusionados` de una fusión anterior y el cast del arreglo moría
-- con 22P02. Solo fallaba en UN sentido —cuando la que se conserva tiene el
-- campo vacío— porque `coalesce` corta la evaluación. Por eso se prueban las
-- dos direcciones y además el caso en que las DOS traen arreglo.
begin;
do $$
declare
  v_a uuid; v_b uuid; v_res text[]; v_n int;
begin
  -- 1) La que se conserva sin arreglo, la duplicada con arreglo: el que fallaba.
  insert into members (first_name,last_name,is_active) values ('ZZArr','Principal',true) returning id into v_a;
  insert into members (first_name,last_name,is_active,external_id_fusionados)
    values ('ZZArr','Duplicada',true,array['25158']) returning id into v_b;
  perform merge_members(v_a, v_b, true);
  select external_id_fusionados into v_res from members where id = v_a;
  if v_res is distinct from array['25158'] then
    raise exception 'FALLA: esperaba {25158} y quedó %', v_res;
  end if;

  -- 2) La que se conserva YA tiene arreglo: no se le pisa.
  insert into members (first_name,last_name,is_active,external_id_fusionados)
    values ('ZZArr','Principal2',true,array['111']) returning id into v_a;
  insert into members (first_name,last_name,is_active,external_id_fusionados)
    values ('ZZArr','Duplicada2',true,array['222']) returning id into v_b;
  perform merge_members(v_a, v_b, true);
  select external_id_fusionados into v_res from members where id = v_a;
  if v_res is distinct from array['111'] then
    raise exception 'FALLA: la fusión pisó un dato que ya estaba: %', v_res;
  end if;

  -- 3) Arreglo VACÍO en la duplicada: no debe reventar ni inventar.
  insert into members (first_name,last_name,is_active) values ('ZZArr','Principal3',true) returning id into v_a;
  insert into members (first_name,last_name,is_active,dietary_restrictions)
    values ('ZZArr','Duplicada3',true,array[]::text[]) returning id into v_b;
  perform merge_members(v_a, v_b, true);
  select coalesce(array_length(dietary_restrictions,1),0) into v_n from members where id = v_a;
  if v_n <> 0 then raise exception 'FALLA: el arreglo vacío trajo % elementos', v_n; end if;

  raise notice '✓ los tres casos pasan';
end $$;
rollback;
