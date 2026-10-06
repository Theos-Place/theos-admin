-- FIN-9 · «Congelar matrícula»: el crédito personal.
--
-- Decidido con Meli el 2026-09-29. Alguien paga un estudio, no puede seguir,
-- y en vez de perder la plata (o que Theos se la devuelva y pierda a la
-- persona) se le GUARDA como crédito para el bloque siguiente.
--
-- POR QUÉ NO ALCANZA EL MECANISMO DE CUPONES QUE YA EXISTE, que era lo que
-- la spec suponía. Se midió: los cupones de hoy son `kind='generica'` y el
-- CHECK `scholarships_kind_shape_check` les exige member_id NULL y code NOT
-- NULL. Este crédito es al revés en las tres cosas:
--
--   · TIENE DUEÑO. Es la plata de esa persona, no una promoción al portador.
--   · NO TIENE CÓDIGO. Nadie lo teclea: finanzas lo aplica.
--   · NO ESTÁ ATADO A UN DESTINO. Sirve para el estudio al que vuelva o para
--     una actividad grande; `scholarships_entity_target_check` hoy OBLIGA a
--     un plan_id o un event_id.
--
-- Así que entra como un `kind` nuevo y se relajan los tres CHECK — relajan,
-- no se borran: cada forma sigue teniendo la suya.
--
-- `origin_payment_id` es lo que vuelve esto contable. Cada crédito nace de
-- un pago concreto, y sin ese vínculo el reporte de reclasificaciones
-- (persona, pago origen, rubro origen, crédito, dónde se usó, rubro destino)
-- no se puede armar.

alter table public.scholarships
  add column if not exists origin_payment_id uuid references public.payments(id) on delete set null;

comment on column public.scholarships.origin_payment_id is
  'FIN-9: el pago del cual salió este crédito. Es lo que permite el reporte de reclasificaciones.';

-- El motivo por el que se congeló, en palabras de finanzas. Obligatorio para
-- los créditos: dentro de seis meses, «¿por qué esta persona tiene ₡5.000
-- guardados?» tiene que tener respuesta sin preguntarle a nadie.
alter table public.scholarships
  add column if not exists freeze_reason text;

comment on column public.scholarships.freeze_reason is
  'FIN-9: por qué se congeló la matrícula. Lo escribe finanzas al emitir el crédito.';

do $$
begin
  -- 1 · El kind nuevo.
  alter table public.scholarships drop constraint if exists scholarships_kind_check;
  alter table public.scholarships
    add constraint scholarships_kind_check
    check (kind in ('asignada', 'generica', 'credito'));

  -- 2 · La FORMA de cada kind. Las dos viejas quedan EXACTAMENTE igual; se
  --     agrega la del crédito: con dueño, sin código y con pago de origen.
  alter table public.scholarships drop constraint if exists scholarships_kind_shape_check;
  alter table public.scholarships
    add constraint scholarships_kind_shape_check
    check (
      (kind = 'asignada'  and member_id is not null and code is null)
      or (kind = 'generica' and member_id is null and code is not null)
      or (kind = 'credito'  and member_id is not null and code is null
                            and origin_payment_id is not null
                            and freeze_reason is not null
                            and length(btrim(freeze_reason)) >= 10)
    );

  -- 3 · El destino. Un crédito NO apunta a un plan ni a un evento: su gracia
  --     es servir para aquello a lo que la persona vuelva.
  alter table public.scholarships drop constraint if exists scholarships_entity_target_check;
  alter table public.scholarships
    add constraint scholarships_entity_target_check
    check (
      (kind = 'credito' and entity_type is null and plan_id is null and event_id is null)
      or (entity_type = 'study_plan' and plan_id is not null and event_id is null)
      or (entity_type = 'event' and event_id is not null and plan_id is null)
    );
end $$;

-- Los créditos vivos de una persona: la consulta de cada pago que se cobra.
create index if not exists scholarships_creditos_vivos
  on public.scholarships (member_id) where kind = 'credito' and status = 'active';

-- El reporte de reclasificaciones barre por fecha de emisión.
create index if not exists scholarships_creditos_por_fecha
  on public.scholarships (created_at) where kind = 'credito';
