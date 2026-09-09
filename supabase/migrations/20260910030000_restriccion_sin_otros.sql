-- Se elimina la opción "Otros" de la restricción alimenticia (decisión del
-- usuario, 2026-09-10, el mismo día que se creó el campo).
--
-- Con "Otros" se va también dietary_restrictions_other, que existía solo para
-- ella: una columna sin uso posible es una invitación a que alguien la vuelva a
-- llenar por otro camino. Se puede borrar sin más porque el campo se creó hoy y
-- NADIE tiene datos: verificado, 0 filas con dietary_restrictions no vacío.
--
-- El CHECK de la pareja (otros ⟺ texto) desaparece con la columna; el de la
-- lista de claves se reescribe sin 'otros'.

do $$
declare
  v_con_datos int;
begin
  select count(*) into v_con_datos from members
   where cardinality(dietary_restrictions) > 0
      or nullif(btrim(coalesce(dietary_restrictions_other,'')),'') is not null;
  if v_con_datos > 0 then
    raise exception
      'Hay % personas con restricción alimenticia cargada. Revisá qué hacer con ellas antes de quitar «Otros».', v_con_datos;
  end if;
end $$;

alter table members drop constraint if exists members_dietary_other_check;
alter table members drop column if exists dietary_restrictions_other;

alter table members drop constraint if exists members_dietary_restrictions_check;
alter table members
  add constraint members_dietary_restrictions_check
  check (dietary_restrictions <@ array['celiaquia','intolerancia_lactosa','vegana']::text[]);
