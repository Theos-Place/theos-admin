import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { sendBroadcast, NO_RECIPIENTS, type Recipient } from '@/lib/supabase/queries/communications'

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
    // Nadie elegible (bajas, rebotes, quejas, sin correo): el mensaje ya viene
    // armado desde sendBroadcast y el broadcast volvió a 'draft'.
    if (error instanceof Error && error.message.startsWith(`${NO_RECIPIENTS}:`)) {
      return NextResponse.json(
        { error: error.message.slice(NO_RECIPIENTS.length + 1), code: 'sin_destinatarios' },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message === 'BROADCAST_YA_ENVIADO') {
      return NextResponse.json(
        { error: 'Este comunicado ya fue enviado (o se está enviando). Refrescá la página para ver su estado.' },
        { status: 409 },
      )
    }
    console.error('POST /api/communications/messages/[id]/send:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
