import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import {
  processPendingEmails, retryFailedEmails, getBroadcastQueueStats,
} from '@/lib/supabase/queries/communications'
import { isEmailConfigured } from '@/lib/email/provider'

/** Autorizado si trae el CRON_SECRET (cron de Supabase) o una sesión con rol. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
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
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: 'El proveedor de email (SES) no está configurado. Revisá las variables SES_* del servidor.' },
        { status: 400 },
      )
    }
    const { id } = await params
    // A8: procesar un DRAFT (0 logs) lo marcaba 'failed' e insendable para
    // siempre. Los borradores se envían por /send, no por /process.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data: b } = await createAdminClient()
      .from('message_broadcasts').select('status').eq('id', id).maybeSingle()
    if (!b) return NextResponse.json({ error: 'Comunicado no encontrado' }, { status: 404 })
    if ((b as { status: string }).status === 'draft') {
      return NextResponse.json(
        { error: 'Este comunicado es un borrador; envialo primero desde su pantalla.' },
        { status: 409 },
      )
    }
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
