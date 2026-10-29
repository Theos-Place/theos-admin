import { NextRequest, NextResponse } from 'next/server'
import { requireEventAccess } from '@/lib/auth/event-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'
import { isUuid } from '@/lib/validate'
import { vincularRespuestaAFicha, RespuestaAjenaError } from '@/lib/supabase/queries/events'

/**
 * Quiénes llenaron el formulario de inscripción del evento por el LINK PÚBLICO,
 * sin entrar al sistema (2026-10-19, Matrimonios).
 *
 * Esas respuestas no quedan ligadas a una ficha, así que el sistema no puede
 * crearles la inscripción ni el cobro: no aparecen en la lista de inscritos y
 * nadie se enteraba. Esto las muestra aparte, para que alguien las asocie o
 * le escriba a la persona. Mismo permiso que la lista de inscripciones.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await requireEventAccess(id)
    if (auth.res) return auth.res
    const supabase = createAdminClient()
    const { data: ev, error: eEv } = await supabase.from('events').select('registration_form_id').eq('id', id).maybeSingle()
    if (eEv) throw eEv
    const formId = (ev as { registration_form_id: string | null } | null)?.registration_form_id
    if (!formId) return NextResponse.json({ formId: null, items: [] })
    const { data, error } = await supabase.from('form_responses')
      .select('id, guest_name, guest_email, submitted_at')
      .eq('form_id', formId).is('member_id', null)
      .order('submitted_at', { ascending: true }).limit(500)
    if (error) throw error
    return NextResponse.json({
      formId,
      items: ((data ?? []) as Array<{ id: string; guest_name: string | null; guest_email: string | null; submitted_at: string }>)
        .map(r => ({ id: r.id, nombre: r.guest_name ?? 'Sin nombre', email: r.guest_email, fecha: r.submitted_at })),
    })
  } catch (error) {
    reportarError('GET /api/events/[id]/guest-responses:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * EVE-15 · Vincula una respuesta por el link a una ficha existente.
 * Body: { response_id, member_id }. El disparador de la base pasa el check-in
 * del invitado a la persona. Misma puerta que el check-in: quien opera el
 * evento. Lo que NO hace (todavía, EVE-14): crear la inscripción ni el cobro.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireEventAccess(id, { puerta: true })
  if (auth.res) return auth.res
  try {
    const body = await req.json().catch(() => null)
    const responseId = typeof body?.response_id === 'string' ? body.response_id : ''
    const memberId = typeof body?.member_id === 'string' ? body.member_id : ''
    if (!isUuid(responseId) || !isUuid(memberId)) {
      return NextResponse.json({ error: 'Se requieren response_id y member_id válidos' }, { status: 400 })
    }
    await vincularRespuestaAFicha(id, responseId, memberId, auth.ctx.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof RespuestaAjenaError) {
      return NextResponse.json({ error: 'Esa inscripción no es de este evento o ya tiene ficha.' }, { status: 404 })
    }
    reportarError('PATCH /api/events/[id]/guest-responses:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
