-- FIN-15 · Tercera frecuencia de arreglo: 'personalizada' (la fecha de cada
-- tracto se pone a mano, caso «el 20 le pago»). Los vencimientos ya viven en
-- cada tracto (payments.due_date), así que no hace falta otra columna: solo
-- abrir el CHECK. Al 2026-10-30 no hay ningún arreglo en producción.

alter table public.payment_plans
  drop constraint if exists payment_plans_frequency_check;

alter table public.payment_plans
  add constraint payment_plans_frequency_check
  check (frequency in ('mensual', 'quincenal', 'personalizada'));

comment on column public.payment_plans.frequency is
  'mensual | quincenal (15 y 30) | personalizada (fecha a mano por tracto; ver payments.due_date). FIN-8 / FIN-15.';
