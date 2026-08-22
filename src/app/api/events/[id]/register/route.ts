import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { resolveOnBehalf, EVENT_ON_BEHALF_ROLES } from '@/lib/auth/on-behalf'
import {
  createRegistration, registrationPricing,
  PaymentRequiredError, EventFullError, AlreadyRegisteredError,
} from '@/lib/supabase/queries/events'
import { scholarshipErrorResponse } from '@/lib/supabase/queries/scholarships'

// Quién puede inscribir A OTRO desde acá (mismos roles que gestionan
// event_registrations en la ruta de staff, /api/events/[id]/registrations).

// POST /api/events/[id]/register — autoservicio: cualquier autenticado se
// inscribe a sí mismo; staff puede inscribir a otro pasando member_id.
// Si el evento requiere pago (sin exención), la inscripción queda 'pending'
// (reservada) hasta subir el comprobante — ver /api/event-registrations/[id]/comprobante.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles() // solo exige sesión
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    // FRM-4: quién inscribió, si no fue la propia persona.
    const { memberId, recordedBy } = resolveOnBehalf(auth.ctx, body?.member_id, EVENT_ON_BEHALF_ROLES)
    if (!memberId) return NextResponse.json({ error: 'No se pudo determinar el miembro.' }, { status: 400 })

    const pricing = await registrationPricing(id, memberId)
    const res = await createRegistration(id, { member_id: memberId, scholarship_id: body?.scholarship_id, coupon_code: body?.coupon_code, recorded_by: recordedBy })
    return NextResponse.json({ ...res, pricing }, { status: 201 })
  } catch (error) {
    if (error instanceof PaymentRequiredError) return NextResponse.json({ error: error.message }, { status: 422 })
    if (error instanceof AlreadyRegisteredError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof EventFullError) return NextResponse.json({ error: error.message }, { status: 409 })
    if (error instanceof Error && error.message.startsWith('TRACTO_VENCIDO:')) {
      return NextResponse.json(
        { error: error.message.slice('TRACTO_VENCIDO:'.length), code: 'tracto_vencido' },
        { status: 409 },
      )
    }
    const scholarshipRes = scholarshipErrorResponse(error)
    if (scholarshipRes) return scholarshipRes
    console.error('POST /api/events/[id]/register:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
