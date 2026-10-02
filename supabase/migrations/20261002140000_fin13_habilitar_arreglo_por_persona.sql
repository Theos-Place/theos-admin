-- FIN-13 · Habilitar el arreglo de pago persona por persona.
--
-- POR QUÉ NO HAY UN BOTÓN PÚBLICO. Se decidió el 2026-09-29 y el miedo está
-- fundado: el de becas no se promocionó nunca y la gente curiosa lo encontró
-- igual. Un «solicitar arreglo» abierto convertiría la excepción en la vía
-- normal de pago.
--
-- En su lugar finanzas HABILITA el arreglo sobre UN cobro concreto, y recién
-- ahí esa persona ve la opción en Mis pagos. Es la misma decisión de siempre
-- —el arreglo se conversa— pero sin obligar a que finanzas lo arme por ella.
--
-- Dos columnas y nada más: cuándo se habilitó y quién. Un booleano solo no
-- alcanzaba — «¿desde cuándo lo tiene habilitado?» es la primera pregunta
-- cuando alguien reclama, y la fecha la contesta sin ir al audit_log.
--
-- NULL = no habilitado, que es el estado de los 358 pagos que ya existen.

alter table public.payments
  add column if not exists payment_plan_enabled_at  timestamptz,
  add column if not exists payment_plan_enabled_by  uuid references public.members(id) on delete set null;

comment on column public.payments.payment_plan_enabled_at is
  'FIN-13: cuándo finanzas habilitó a esta persona a acogerse a un arreglo sobre ESTE cobro. NULL = no habilitado.';
comment on column public.payments.payment_plan_enabled_by is
  'FIN-13: quién lo habilitó (members.id). Se conserva aunque la ficha se desactive.';

-- El índice es parcial a propósito: lo habilitado es un puñado contra todos
-- los pagos, y la consulta que importa —«¿cuáles están habilitados?»— solo
-- mira esas filas.
create index if not exists payments_arreglo_habilitado
  on public.payments (member_id)
  where payment_plan_enabled_at is not null;
