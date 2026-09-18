-- DON-2 · Registrar una donación a mano desde la pantalla.
--
-- Tres cambios, todos porque la tabla solo contemplaba el import de archivos:
--
-- 1. `amount` pasa a aceptar NULL. El alta manual permite registrar una
--    donación SIN monto —pasa cuando se sabe que alguien dio pero el reporte
--    del banco todavía no llegó—. Se acepta el nulo y NO un 0: cero es un monto
--    real y sumaría como tal en los reportes, mientras que el nulo dice "no se
--    sabe". `donation_stats` usa `sum(amount)`, que ignora los nulos, así que
--    una donación sin monto cuenta como donación y no mueve los totales, que es
--    exactamente lo que se quiere.
--
-- 2. `note` para el detalle que hoy no tiene dónde ir ("Donación para Edificio
--    - Campaña MyH"). El import lo llamaba `source_file`, que es otra cosa.
--
-- 3. `created_by` para saber QUIÉN la registró. Una donación escrita a mano sin
--    autor es justo el dato que después nadie puede explicar; el import ya deja
--    rastro por `source_file` y el alta manual no tenía ninguno.
alter table public.donations
  alter column amount drop not null,
  add column if not exists note text,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

comment on column public.donations.amount is
  'NULL = donación registrada sin monto conocido (alta manual). 0 sería un monto real.';
comment on column public.donations.note is
  'Detalle libre del alta manual, p. ej. "Donación para Edificio - Campaña MyH".';
comment on column public.donations.created_by is
  'Quién la registró a mano (auth.users). NULL en las importadas: esas se rastrean por source_file.';
