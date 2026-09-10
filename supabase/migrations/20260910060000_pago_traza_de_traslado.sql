-- La traza de cuando un pago se mueve de una matrícula a otra.
--
-- Al cambiar a alguien de grupo, su pago viaja con la matrícula en vez de
-- generarle un cobro nuevo. Finanzas ve el pago colgando de un grupo distinto
-- del que dice el comprobante, y sin esta nota no hay forma de saber por qué.
--
-- Va en su propia columna y no dentro de `description` porque description es
-- el concepto del cobro ("Matrícula · Sirviendo como Jesús") y se actualiza al
-- del grupo nuevo: si la traza viviera ahí, la siguiente edición se la comería.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS transfer_note text;

COMMENT ON COLUMN public.payments.transfer_note IS
  'Por qué este pago está en otra matrícula: de qué grupo a cuál, quién lo movió y cuándo. Lo escribe transferEnrollment.';
