-- DEU-3: elimina la columna legacy employees.position (texto NOT NULL).
-- Era redundante: el puesto real vive en position_id → paid_positions y el
-- código la rellenaba desde ahí solo para satisfacer el NOT NULL. La tabla
-- employees está vacía en producción al momento de esta migración.

alter table "public"."employees" drop column "position";
