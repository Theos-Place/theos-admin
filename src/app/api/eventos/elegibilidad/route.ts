import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getEvents, registrationPricing } from '@/lib/supabase/queries/events'
import { computeEventEligibility } from '@/lib/events/eligibility'

// GET /api/eventos/elegibilidad?member_id=X
// Devuelve { eligibility: EventEligibilityResult[] } con eventos abiertos a
// inscripción (requires_registration, activos, fecha futura) para el miembro.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId || !isUuid(memberId)) {
      return NextResponse.json({ error: 'Se requiere member_id válido' }, { status: 400 })
    }
    // El propio perfil siempre se puede consultar sin permiso extra; el de otro
    // miembro exige módulo eventos (mismo criterio que /api/matricula/eligibility).
    if (memberId !== auth.ctx.memberId) {
      const eventos = await requireModuleView('eventos', { beyondOwn: true })
      if (eventos.res) return eventos.res
    }

    const { events } = await getEvents({ is_active: true })
    const now = Date.now()
    const openEvents = events.filter(e => e.requires_registration && new Date(e.starts_at).getTime() >= now)

    const pricingEntries = await Promise.all(
      openEvents.map(async e => [e.id, await registrationPricing(e.id, memberId)] as const),
    )
    const pricingByEvent = new Map(pricingEntries)
    const eligibility = computeEventEligibility(openEvents, memberId, pricingByEvent)
    return NextResponse.json({ eligibility })
  } catch (error) {
    console.error('GET /api/eventos/elegibilidad:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
