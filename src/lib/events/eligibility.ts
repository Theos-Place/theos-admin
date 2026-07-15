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
  is_full: boolean
  spots_available: number | null
  is_eligible: boolean
  reasons_blocked: string[]
}

/** Elegibilidad simple de inscripción a eventos (sin prerequisitos de estudio,
 *  a diferencia de studies/eligibility.ts): solo cupo, ya-inscrito y precio.
 *  El caller debe pasar solo eventos ya filtrados por requires_registration/
 *  is_active/fecha futura — esta función no filtra, solo evalúa. */
export function computeEventEligibility(
  events: DbEventEnriched[],
  memberId: string,
  pricingByEvent: Map<string, EventPricing>,
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
      requires_payment: pricing.requiresPayment,
      price: pricing.price,
      is_server: pricing.isServer,
      exempt: pricing.exempt,
      already_registered: alreadyRegistered,
      registration_status: mine?.payment_status ?? null,
      is_full: isFull,
      spots_available: e.max_capacity != null && e.max_capacity > 0 ? Math.max(0, e.max_capacity - occupied) : null,
      is_eligible: !alreadyRegistered && !isFull,
      reasons_blocked,
    }
  })
}
