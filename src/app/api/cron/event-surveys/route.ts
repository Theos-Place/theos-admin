import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSurveyDue } from '@/lib/events/survey-schedule'
import { dispatchEventSurvey } from '@/lib/email/event-survey-notify'
import { DAILY_LIMIT } from '@/lib/email/provider'

/** Autorizado con el CRON_SECRET o sesión de quien gestiona eventos. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones', 'admin')
  return auth.res ?? null
}

// EVE-4 · Despacha las encuestas de satisfacción cuyo momento ya pasó.
//
// Dedupe: events.survey_sent_at. El cron solo toma los que lo tienen en NULL y
// lo sella al terminar, así que correr dos veces el mismo día no reenvía.
// Destinatarios: quienes hicieron check-in (ver event-survey-notify).
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const supabase = createAdminClient()
    const ahora = new Date()

    const { data, error } = await supabase
      .from('events')
      .select('id, title, status, requires_survey, survey_form_id, survey_template_id, survey_offset_hours, survey_send_at, survey_sent_at')
      .eq('requires_survey', true)
      .is('survey_sent_at', null)
      .not('survey_send_at', 'is', null)
      .lte('survey_send_at', ahora.toISOString())
      .order('survey_send_at')
      .limit(200)
    if (error) throw error

    // La consulta ya filtra, pero la condición canónica es la función pura: si
    // alguna vez se agrega un caso (cancelado, sin destino), vale para los dos.
    const pendientes = ((data ?? []) as Parameters<typeof isSurveyDue>[0][])
      .filter(e => isSurveyDue(e, ahora))

    // Techo diario de correos compartido: no se vacía la cuota en un evento.
    let presupuesto = DAILY_LIMIT
    const resultados: Array<{ event_id: string; sent: number; recipients: number; skipped?: string }> = []
    for (const e of pendientes) {
      if (presupuesto <= 0) break
      const evento = e as unknown as Parameters<typeof dispatchEventSurvey>[0]
      const r = await dispatchEventSurvey(evento, { maxEmails: presupuesto })
      presupuesto -= r.sent
      resultados.push({ event_id: evento.id, ...r })
    }

    await pingHealthcheck('HEALTHCHECK_URL_EVENT_SURVEYS')
    return NextResponse.json({
      due: pendientes.length,
      dispatched: resultados.length,
      sent: resultados.reduce((n, r) => n + r.sent, 0),
      results: resultados,
    })
  } catch (error) {
    console.error('POST /api/cron/event-surveys:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
