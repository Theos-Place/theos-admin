import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import {
  processPendingEmails, retryFailedEmails, getBroadcastQueueStats,
} from '@/lib/supabase/queries/communications'
import { isBrevoConfigured } from '@/lib/email/brevo'

/** Autorizado si trae el CRON_SECRET (cron de Supabase) o una sesión con rol. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && bearer === process.env.CRON_SECRET) return null
  const auth = await requireRoles('comunicaciones', 'direccion')
  return auth.res ?? null
}

// GET: estado de la cola del broadcast (para la UI de progreso).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await authorize(req)
    if (denied) return denied
    const { id } = await params
    return NextResponse.json(await getBroadcastQueueStats(id))
  } catch (error) {
    console.error('GET /api/communications/messages/[id]/process:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: procesa los pendientes de hoy. Body opcional: { retry_failed: true }
// reencola los fallidos antes de procesar.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await authorize(req)
    if (denied) return denied
    if (!isBrevoConfigured()) {
      return NextResponse.json(
        { error: 'Configurá Brevo primero en Configuración → Comunicaciones' },
        { status: 400 },
      )
    }
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    let retried = 0
    if (body?.retry_failed) retried = await retryFailedEmails(id)
    const result = await processPendingEmails(id)
    return NextResponse.json({ ...result, retried })
  } catch (error) {
    console.error('POST /api/communications/messages/[id]/process:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
