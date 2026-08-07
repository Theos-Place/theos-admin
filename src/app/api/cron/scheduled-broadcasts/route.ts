import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchScheduledBroadcasts, processPendingEmails } from '@/lib/supabase/queries/communications'

/** Autorizado con el CRON_SECRET o por quien gestiona comunicaciones. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('comunicaciones', 'direccion', 'admin')
  return auth.res ?? null
}

/**
 * Manda los comunicados programados cuya hora ya pasó.
 *
 * NO está en vercel.json: el plan de Vercel es Hobby y ahí un cron solo puede
 * correr una vez al día — un schedule más frecuente hace que Vercel rechace el
 * deployment entero. El disparo cada 15 minutos viene de afuera (ver
 * docs/plan-desarrollo.md). La hora que elige el usuario no es exacta al
 * minuto: sale en el primer barrido posterior, y la pantalla lo dice.
 *
 * Además arrastra la COLA DIARIA: cuando un envío no cabe en el cupo del día,
 * sendBroadcast reparte los correos en días siguientes (message_logs con
 * scheduled_date futuro) y hasta ahora nadie los procesaba — quedaban colgados
 * esperando que alguien entrara a apretar "procesar" a mano.
 */
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const ahora = new Date()
    const despachados = await dispatchScheduledBroadcasts(ahora)

    // Cola diaria: broadcasts a medio enviar con pendientes de hoy o atrasados.
    const supabase = createAdminClient()
    const hoy = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' })
    const { data: colaData } = await supabase
      .from('message_logs')
      .select('broadcast_id')
      .eq('status', 'pending')
      .eq('channel', 'email')
      .lte('scheduled_date', hoy)
      .limit(1000)
    const pendientes = [...new Set(
      ((colaData ?? []) as Array<{ broadcast_id: string | null }>)
        .map(r => r.broadcast_id).filter((x): x is string => !!x),
    )]

    const cola: Array<{ id: string; sent: number; failed: number }> = []
    for (const broadcastId of pendientes) {
      try {
        const r = await processPendingEmails(broadcastId)
        if (r.sent || r.failed) cola.push({ id: broadcastId, ...r })
      } catch (e) {
        console.warn('cola diaria:', broadcastId, e)
      }
    }

    await pingHealthcheck('HEALTHCHECK_URL_SCHEDULED_BROADCASTS')
    return NextResponse.json({
      scheduled_sent: despachados.filter(d => d.ok).length,
      scheduled_failed: despachados.filter(d => !d.ok).length,
      results: despachados,
      queue_processed: cola,
    })
  } catch (error) {
    console.error('POST /api/cron/scheduled-broadcasts:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
