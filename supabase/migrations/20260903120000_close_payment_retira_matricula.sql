-- Cerrar el cobro de una matrícula tiene que retirar la matrícula.
--
-- `transitionPaymentQueue('close')` marcaba el pago 'failed' y ahí se detenía:
-- "NO activa matrícula/inscripción". El problema es que tampoco la DESACTIVA,
-- así que una matrícula que ya estaba activa quedaba adentro con el cobro
-- cerrado sin pagar — ocupando cupo y sin que nadie deba nada.
--
-- Caso real (2026-09-02): Michelle Alfaro Herrera se inscribió por error,
-- alguien cerró su cobro de ₡15.000 y su matrícula siguió en 'enrolled'.
--
-- Va por RPC porque son dos tablas y tiene que ser atómico: dejar el cobro
-- cerrado con la matrícula activa es justo el estado que se quiere evitar.

create or replace function public.close_payment_ticket(
  p_payment_id uuid,
  p_reviewer uuid,
  p_reason text
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_concept text;
  v_enrollment uuid;
  v_event_registration uuid;
begin
  update payments
  set status = 'cancelado', rejection_reason = p_reason,
      reviewed_by = p_reviewer, reviewed_at = now()
  where id = p_payment_id and status = 'pending'
  returning concept, enrollment_id, event_registration_id
    into v_concept, v_enrollment, v_event_registration;
  if not found then return false; end if;

  -- La matrícula se retira con el mismo motivo: si el cobro no se va a cobrar,
  -- la persona no está adentro. Solo desde estados vivos — una matrícula ya
  -- completada o retirada no se toca.
  if v_concept in ('matricula', 'folletos') and v_enrollment is not null then
    update study_enrollments
    set status = 'dropped', dropped_at = now(),
        drop_reason = coalesce(nullif(p_reason, ''), 'Se cerró el cobro sin pagar')
    where id = v_enrollment and status in ('enrolled', 'pendiente_de_pago');
  elsif v_concept = 'evento' and v_event_registration is not null then
    update event_registrations set payment_status = 'cancelado'
    where id = v_event_registration and payment_status = 'pending';
  end if;
  return true;
end $$;

revoke execute on function public.close_payment_ticket(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.close_payment_ticket(uuid, uuid, text) to service_role;

comment on function public.close_payment_ticket is
  'Cierra un cobro sin pagarlo Y retira la matrícula/inscripción asociada. Atómico: ver migración 20260903120000.';
