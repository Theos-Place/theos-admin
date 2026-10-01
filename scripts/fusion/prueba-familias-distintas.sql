-- La fusión con cada ficha en una familia distinta. Revierte siempre.
--   node scripts/staging/aplicar-sql.mjs scripts/fusion/prueba-familias-distintas.sql
--
-- Caso de Liam Salazar Calderon (2026-09-30): dos fichas, cada una en una
-- familia, y la fusión moría con un 23505 del índice único de family_members
-- en LAS DOS direcciones. Se prueban las dos a propósito: el primer arreglo
-- que se nos ocurra puede andar en un sentido y no en el otro, y quien
-- fusiona elige cuál ficha conserva.
begin;
do $$
declare
  v_keep uuid; v_dup uuid; v_fam_vieja uuid; v_fam_nueva uuid; v_quedo uuid; v_n int; v_n2 int;
begin
  for v_n in 1..2 loop
    insert into family_units (name) values ('ZZFamilia Vieja') returning id into v_fam_vieja;
    insert into family_units (name) values ('ZZFamilia Nueva') returning id into v_fam_nueva;
    insert into members (first_name,last_name,is_active) values ('ZZLiam','Uno',true) returning id into v_keep;
    insert into members (first_name,last_name,is_active) values ('ZZLiam','Dos',true) returning id into v_dup;

    -- El vínculo NUEVO lo tiene la principal en la vuelta 1 y el duplicado en
    -- la 2. El resultado esperado es el mismo: gana «ZZFamilia Nueva».
    if v_n = 1 then
      insert into family_members (family_unit_id,member_id,relation,created_at)
        values (v_fam_nueva,v_keep,'Hijo/a','2026-09-15'), (v_fam_vieja,v_dup,'Hijo/a','2026-06-08');
    else
      insert into family_members (family_unit_id,member_id,relation,created_at)
        values (v_fam_vieja,v_keep,'Hijo/a','2026-06-08'), (v_fam_nueva,v_dup,'Hijo/a','2026-09-15');
    end if;

    perform merge_members(v_keep, v_dup, true);

    select count(*) into v_n2 from family_members where member_id = v_keep;
    select family_unit_id into v_quedo from family_members where member_id = v_keep;
    if v_quedo is distinct from v_fam_nueva then
      raise exception 'FALLA (vuelta %): quedó en la familia equivocada', v_n;
    end if;
    raise notice '✓ vuelta %: la fusión pasó y quedó en la familia más reciente', v_n;
  end loop;
end $$;
rollback;
