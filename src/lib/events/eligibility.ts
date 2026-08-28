import type { DbEventEnriched } from '@/lib/supabase/queries/events'
import type { EventPaymentStatus } from '@/types/event'

export type EventPricing = { requiresPayment: boolean; isServer: boolean; exempt: boolean; price: number }

export type EventEligibilityResult = {
  event_id: string
  title: string
  starts_at: string
  requires_payment: boolean
  price: number
  is_server: boolean
  exempt: boolean
  already_registered: boolean
  registration_status: EventPaymentStatus | null
  /** Id de MI inscripción (null si no estoy inscrito). Permite reabrir el modal
   *  del comprobante desde la tarjeta cuando el pago quedó pendiente. */
  registration_id: string | null
  /** EVE-4: si el evento tiene formulario de inscripción, "Inscribirme" lleva a
   *  llenarlo en vez de abrir el modal (ver registerDestination). */
  registration_form_id: string | null
  /**
   * Mi comprobante está subido y esperando a finanzas.
   *
   * Hace falta porque `registration_status` NO alcanza para saberlo: se queda en
   * 'pending' desde que la persona se inscribe hasta que finanzas aprueba, así
   * que "todavía no subió el comprobante" y "ya lo subió y está en revisión" se
   * ven IDÉNTICOS. Mostrar "falta el pago" a quien acaba de pagar es el reclamo
   * que llegó el 2026-08-27. Lo que marca la diferencia vive en otra tabla:
   * payments.review_status = 'en_revision'.
   */
  payment_in_review: boolean
  is_full: boolean
  spots_available: number | null
  is_eligible: boolean
  reasons_blocked: string[]
  // Campos de despliegue (calendario/lista/cuadrícula) — quien no gestiona el
  // módulo eventos arma su vista solo con este resultado, sin /api/events.
  event_type: string
  ends_at: string | null
  location: string | null
  flyer_url: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  max_capacity: number | null
  status: DbEventEnriched['status']
  /** false = interno. La elegibilidad SÍ lo devuelve (si no, el link de
   *  inscripción de un evento interno no encontraría nada y el botón volvería a
   *  no hacer nada); son las LISTAS del calendario las que lo esconden. */
  is_public: boolean
  registrations_count: number
}

/** Elegibilidad simple de inscripción a eventos (sin prerequisitos de estudio,
 *  a diferencia de studies/eligibility.ts): solo cupo, ya-inscrito y precio.
 *  El caller debe pasar solo eventos ya filtrados por requires_registration/
 *  is_active/fecha futura — esta función no filtra, solo evalúa. */
export function computeEventEligibility(
  events: DbEventEnriched[],
  memberId: string,
  pricingByEvent: Map<string, EventPricing>,
  /** Ids de inscripción con comprobante en revisión. Se pasa desde afuera porque
   *  vive en `payments` y esta función es pura (no consulta nada). */
  comprobantesEnRevision: Set<string> = new Set(),
): EventEligibilityResult[] {
  return events.map(e => {
    const occupied = e.registrations.filter(
      r => r.payment_status === 'pending' || r.payment_status === 'paid' || r.payment_status === 'exempted',
    ).length
    const mine = e.registrations.find(r => r.member_id === memberId)
    const alreadyRegistered = !!mine
    const isFull = e.max_capacity != null && e.max_capacity > 0 && occupied >= e.max_capacity && !alreadyRegistered
    const pricing = pricingByEvent.get(e.id) ?? { requiresPayment: false, isServer: false, exempt: false, price: 0 }

    const reasons_blocked: string[] = []
    if (alreadyRegistered) reasons_blocked.push('Ya estás inscrito/a en este evento.')
    if (isFull) reasons_blocked.push('El evento alcanzó su capacidad máxima.')

    return {
      event_id: e.id,
      title: e.title,
      starts_at: e.starts_at,
      registration_form_id: e.registration_form_id ?? null,
      requires_payment: pricing.requiresPayment,
      price: pricing.price,
      is_server: pricing.isServer,
      exempt: pricing.exempt,
      already_registered: alreadyRegistered,
      registration_status: mine?.payment_status ?? null,
      registration_id: mine?.id ?? null,
      payment_in_review: !!mine?.id && comprobantesEnRevision.has(mine.id),
      is_full: isFull,
      spots_available: e.max_capacity != null && e.max_capacity > 0 ? Math.max(0, e.max_capacity - occupied) : null,
      is_eligible: !alreadyRegistered && !isFull,
      reasons_blocked,
      event_type: e.event_type,
      ends_at: e.ends_at,
      location: e.location,
      flyer_url: e.flyer_url,
      is_recurring: e.is_recurring,
      recurrence_rule: e.recurrence_rule,
      max_capacity: e.max_capacity,
      status: e.status,
      is_public: e.is_public !== false,
      registrations_count: occupied,
    }
  })
}
