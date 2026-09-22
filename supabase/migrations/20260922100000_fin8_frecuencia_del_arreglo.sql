-- FIN-8 · Los arreglos de pago pueden ser mensuales o quincenales.
--
-- Hasta hoy los tractos vencían SOLO mes a mes. Finanzas pidió poder pactar
-- cada 15 días, que es como cobra mucha gente su salario.
--
-- Los arreglos que ya existen quedan MENSUALES sin migrar datos: el default de
-- la columna los cubre a todos. Por eso la columna no es nullable — un arreglo
-- sin frecuencia no significa nada, y dejarla en null obligaría a cada
-- consumidor a decidir qué hacer con ese caso.
--
-- "Quincenal" son los días 15 y 30 de cada mes —así se paga el salario acá—,
-- con el último día del mes cuando no hay 30 (febrero). La regla vive en
-- `quincenalDueDates` (src/lib/finance/installments.ts), con sus tests.

alter table public.payment_plans
  add column if not exists frequency text not null default 'mensual';

alter table public.payment_plans
  drop constraint if exists payment_plans_frequency_check;

alter table public.payment_plans
  add constraint payment_plans_frequency_check
  check (frequency in ('mensual', 'quincenal'));

comment on column public.payment_plans.frequency is
  'FIN-8: cada cuánto vencen los tractos. quincenal = los días 15 y 30 de cada mes (el último día del mes cuando no hay 30).';
