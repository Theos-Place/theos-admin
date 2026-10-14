-- PAG-5 · Un solo comprobante para varios cobros.
--
-- Cuando alguien hace UNA transferencia que cubre tres cobros, los tres pagos
-- quedan con la misma referencia y el mismo archivo. Eso choca de frente con
-- FIN-6, que bloquea exactamente ese patrón porque es la forma del bug de
-- Adriana y Raquel: ₡5.000 transferidos una vez, contados dos.
--
-- Lo que separa los dos casos no es la referencia ni el monto: es si la
-- persona DECLARÓ que ese comprobante cubre varios cobros. Esta columna es esa
-- declaración. Los pagos que la comparten son un solo dinero repartido; dos
-- cargas distintas de la misma referencia siguen bloqueándose igual.
alter table public.payments
  add column if not exists comprobante_grupo uuid;

comment on column public.payments.comprobante_grupo is
  'PAG-5 · Los pagos cubiertos por un mismo comprobante comparten este id. '
  'NULL = pago con su propio comprobante (el caso normal). FIN-6 usa esto '
  'para no confundir «una transferencia que cubre tres cobros» con «el mismo '
  'comprobante cargado tres veces».';

-- Se consulta al revisar una referencia repetida y al abrir un pago del grupo.
create index if not exists payments_comprobante_grupo_idx
  on public.payments (comprobante_grupo)
  where comprobante_grupo is not null;
