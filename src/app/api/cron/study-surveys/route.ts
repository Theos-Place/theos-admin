import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSurveyDue } from '@/lib/studies/study-survey'
import { requestLeaderFeedback } from '@/lib/email/leader-feedback-notify'
import { DAILY_LIMIT } from '@/lib/email/provider'

/** Autorizado con el CRON_SECRET o sesión de coordinación de estudios. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin')
  return auth.res ?? null
}

// EST-12 · Despacha las encuestas de satisfacción de los grupos cerrados cuyo
// momento ya pasó. Mismo molde que event-surveys (EVE-4).
//
// El cierre solo PROGRAMA (survey_send_at); el envío ocurre acá, por defecto al
// día siguiente. Dedupe: study_groups.feedback_requested_at.
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const supabase = createAdminClient()
    const ahora = new Date()

    const { data, error } = await supabase
      .from('study_groups')
      .select('id, name, status, survey_enabled, survey_send_at, feedback_requested_at')
      .eq('survey_enabled', true)
      .is('feedback_requested_at', null)
      .not('survey_send_at', 'is', null)
      .lte('survey_send_at', ahora.toISOString())
      .order('survey_send_at')
      .limit(200)
    if (error) throw error

    // La consulta ya filtra, pero la condición canónica es la función pura: si
    // se agrega un caso, vale para los dos.
    const pendientes = ((data ?? []) as Parameters<typeof isSurveyDue>[0][])
      .filter(g => isSurveyDue(g, ahora))

    // Techo diario compartido: un grupo grande no se come la cuota del resto.
    let presupuesto = DAILY_LIMIT
    const resultados: Array<{ group_id: string; sent: number; skipped?: string }> = []
    for (const g of pendientes) {
      if (presupuesto <= 0) break
      const grupo = g as unknown as { id: string }
      const r = await requestLeaderFeedback(grupo.id)
      presupuesto -= r.sent
      resultados.push({ group_id: grupo.id, sent: r.sent, skipped: r.skipped })
    }

    await pingHealthcheck('HEALTHCHECK_URL_STUDY_SURVEYS')
    return NextResponse.json({
      due: pendientes.length,
      dispatched: resultados.length,
      sent: resultados.reduce((n, r) => n + r.sent, 0),
      results: resultados,
    })
  } catch (error) {
    console.error('POST /api/cron/study-surveys:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
