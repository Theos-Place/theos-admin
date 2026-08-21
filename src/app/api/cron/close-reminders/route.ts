import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { notifyPendingGroupCloses } from '@/lib/email/close-reminder-notify'

/** Autorizado si trae el CRON_SECRET o sesión de coordinación. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('coordinador_dirigentes', 'coordinador_estudios', 'direccion', 'admin')
  return auth.res ?? null
}

// POST: recordatorio de CIERRE al dirigente y co-dirigente (DIR-3).
//
// Dos avisos y no más: uno faltando una semana para terminar, y otro a los 7
// días de vencido si el grupo sigue en curso —ese último también avisa a
// coordinación—. El dedupe vive en study_groups.close_reminder_sent_at y
// close_overdue_notified_at.
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const result = await notifyPendingGroupCloses()
    await pingHealthcheck('HEALTHCHECK_URL_CLOSE_REMINDERS')
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/cron/close-reminders:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
