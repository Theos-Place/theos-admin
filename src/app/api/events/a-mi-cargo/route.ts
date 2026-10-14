import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET · EVT-9 · Los eventos que ESTA sesión tiene a cargo (`event_managers`).
 *
 * POR QUÉ HACE FALTA: «compartirle» un evento a alguien es nombrarlo
 * encargado. El encargado ya podía ABRIR y gestionar su evento —eso lo
 * resuelve `requireEventAccess` por evento—, pero el evento no le aparecía
 * en el calendario si era interno: la lista se arma de la cartelera pública,
 * que por definición no los trae. Le compartían un evento y tenía que
 * guardarse el link para volver a entrar.
 *
 * Solo habla de UNO MISMO, así que alcanza con estar en sesión: no se puede
 * preguntar por los eventos de otra persona.
 */
export async function GET() {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const memberId = auth.ctx.memberId
    if (!memberId) return NextResponse.json({ items: [] })

    const sb = createAdminClient()
    const { data: aCargo, error: e1 } = await sb
      .from('event_managers').select('event_id').eq('member_id', memberId)
    if (e1) throw e1

    const ids = (aCargo ?? []).map(r => (r as { event_id: string }).event_id)
    if (ids.length === 0) return NextResponse.json({ items: [] })

    // Los MISMOS campos de cartelera que /api/public/events, para que la
    // pantalla pueda mezclarlos sin tratarlos distinto. Sin inscripciones ni
    // check-ins: para eso se entra al evento.
    const { data, error } = await sb
      .from('events')
      .select(`
        id, title, description, event_type, status, starts_at, ends_at,
        location, location_url, is_virtual, requires_registration,
        max_capacity, requires_payment, payment_amount, currency, flyer_url,
        registration_form_id, is_public
      `)
      .in('id', ids)
      .not('status', 'in', '("cancelled","archived")')
    if (error) throw error

    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    reportarError('GET /api/events/a-mi-cargo:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
