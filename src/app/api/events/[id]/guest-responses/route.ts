import { NextRequest, NextResponse } from 'next/server'
import { requireEventAccess } from '@/lib/auth/event-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'

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
