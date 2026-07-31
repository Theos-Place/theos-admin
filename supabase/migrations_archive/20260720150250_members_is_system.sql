-- Perfiles de sistema: cuentas institucionales (sedes, logística, funciones)
-- que NO representan a una persona y por diseño NUNCA tendrán cédula.
-- Se excluyen del recordatorio de cédula y de validaciones que la exijan.
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Marcado inicial de las cuentas institucionales detectadas (2026-07). El resto
-- se marca desde la UI de edición (toggle "perfil de sistema", solo admin).
UPDATE members SET is_system = true WHERE external_id = ANY (ARRAY[
  '12965','16483','11053','9918','9916','11509','21189','10839','11056','9917',
  '9915','9920','9919','11057','12126','12511','15200','14682','9914','11893',
  '16631','9921','11052','2032','17140','9517','14093','16484'
]);
