import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { sendBroadcast, type Recipient } from '@/lib/supabase/queries/communications'

// POST: envía el broadcast. Body: { recipients: Recipient[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('comunicaciones', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { recipients } = (await req.json()) as { recipients: Recipient[] }
    await sendBroadcast(id, recipients ?? [])
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('EMAIL_NOT_CONFIGURED')) {
      return NextResponse.json(
        { error: 'El proveedor de email (SES) no está configurado. Revisá las variables SES_* del servidor.' },
        { status: 400 },
      )
    }
    console.error('POST /api/communications/messages/[id]/send:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
