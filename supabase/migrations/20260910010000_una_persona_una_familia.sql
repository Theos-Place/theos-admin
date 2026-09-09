-- INVARIANTE: una persona pertenece a UNA sola familia.
--
-- Hasta hoy family_members solo tenía UNIQUE (family_unit_id, member_id), que
-- impide repetir a alguien DENTRO de una unidad pero no impide que esté en dos.
-- Ese hueco es lo que dejó a Marielena Hernández en dos familias y a los hijos
-- de cada cónyuge repartidos entre ambas (bug 2026-09-09).
--
-- ORDEN OBLIGATORIO: esta migración va DESPUÉS de la reparación de datos
-- (scripts/familias-2026-09/reparar.ts). Con alguien en dos familias, el índice
-- no se puede crear — y eso es deliberado: prefiere fallar el despliegue a
-- inventar cuál de las dos familias descartar.
--
-- La SEPARACIÓN de familias (hijos que se independizan, matrimonios, divorcios)
-- sigue funcionando igual: separar es salir de una unidad y entrar a otra, que
-- este índice permite. Lo que prohíbe es estar en las dos a la vez.

do $$
declare
  v_multi int;
begin
  select count(*) into v_multi from (
    select member_id from family_members group by member_id having count(*) > 1
  ) t;
  if v_multi > 0 then
    raise exception
      'Hay % personas en más de una familia. Corré scripts/familias-2026-09/reparar.ts --aplicar antes de esta migración.', v_multi;
  end if;
end $$;

alter table family_members
  add constraint family_members_member_id_key unique (member_id);

comment on constraint family_members_member_id_key on family_members is
  'Una persona, una familia. Vincular a dos que ya tienen familia las FUSIONA (link_family_member); no las deja en dos.';
