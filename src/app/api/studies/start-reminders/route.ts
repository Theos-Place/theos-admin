import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { notifyUpcomingStudyStarts } from '@/lib/email/study-start-notify'

/** Autorizado si trae el CRON_SECRET (cron de Supabase) o sesión de coordinación. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('coordinador_dirigentes', 'coordinador_estudios', 'direccion')
  return auth.res ?? null
}

// POST: envía el recordatorio "inicio_capacitacion" a los estudiantes inscritos
// de los grupos que arrancan en los próximos días y aún no fueron notificados.
// La invoca a diario la edge function process-email-queue. El dedupe (no reenviar)
// vive en study_groups.start_notified_at.
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const result = await notifyUpcomingStudyStarts()
    await pingHealthcheck('HEALTHCHECK_URL_START_REMINDERS')
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/studies/start-reminders:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
