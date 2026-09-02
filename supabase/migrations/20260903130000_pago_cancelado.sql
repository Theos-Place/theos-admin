-- Separar "falló" de "se canceló".
--
-- Hasta hoy todo lo que no se cobraba caía en 'failed', y eso mezclaba dos
-- cosas que no se parecen:
--
--   · un ERROR del sistema — algo se rompió y el cobro no se pudo procesar;
--   · una CANCELACIÓN — la persona cerró la matrícula, se inscribió por error,
--     o se venció el plazo para subir el comprobante.
--
-- En la pantalla de finanzas los 6 casos que existían decían "Fallido", y los
-- 6 eran cancelaciones: nadie intentó pagar y le rebotó. Leer "3 fallidos"
-- hacía pensar en un problema técnico que no existía.
--
-- 'cancelado' es el estado nuevo. 'failed' queda para lo que su nombre dice:
-- un error de verdad.

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status = any (array['paid', 'pending', 'refunded', 'partial_refund', 'failed', 'cancelado']));

comment on column public.payments.status is
  'paid | pending | refunded | partial_refund | cancelado (la persona canceló, se venció el plazo o se cerró el cobro) | failed (error del sistema al procesar).';

-- Los 6 que existen son cancelaciones, no fallos. Se reclasifican por lo que
-- de verdad pasó: ninguno vino de un error técnico.
update public.payments set status = 'cancelado', updated_at = now()
where status = 'failed';
