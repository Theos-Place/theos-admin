import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getMessages, createBroadcast } from '@/lib/supabase/queries/communications'

// Validación runtime del broadcast (B11 auditoría): el input se esparce entero
// al insert de `message_broadcasts`, así que `.strict()` evita colar columnas
// arbitrarias (p. ej. status, sent_at).
const broadcastCreateSchema = z
  .object({
    template_id: z.string().trim().min(1).nullish(),
    channel: z.enum(['interna', 'whatsapp', 'email', 'both']),
    kind: z.enum(['marketing', 'transactional']).optional(),
    subject: z.string().trim().nullish(),
    body: z.string().min(1),
    body_format: z.enum(['text', 'html']).optional(),
    segment_label: z.string().trim().nullish(),
    recipient_filter: z.unknown().optional(),
    total_recipients: z.number().int().min(0).optional(),
    smtp_config_id: z.string().trim().min(1).nullish(),
    whatsapp_config_id: z.string().trim().min(1).nullish(),
  })
  .strict()

export async function GET() {
  try {
    const auth = await requireModuleView('comunicaciones')
    if (auth.res) return auth.res
    return NextResponse.json(await getMessages())
  } catch (error) {
    console.error('GET /api/communications/messages:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('comunicaciones', 'direccion')
    if (auth.res) return auth.res
  try {
    const parsed = broadcastCreateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const b = await createBroadcast(parsed.data)
    return NextResponse.json(b, { status: 201 })
  } catch (error) {
    console.error('POST /api/communications/messages:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
