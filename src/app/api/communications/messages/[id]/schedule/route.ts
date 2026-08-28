import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { scheduleBroadcast, unscheduleBroadcast } from '@/lib/supabase/queries/communications'
import { resolveScheduledAt, SCHEDULE_MESSAGES } from '@/lib/communications/schedule'
import type { Recipient } from '@/lib/supabase/queries/communications'

// POST: deja el comunicado esperando su hora (status 'scheduled'). Hermano de
// /send: mismo body de destinatarios, más cuándo.
//
// La hora llega como el texto del datetime-local ("2026-08-10T15:30") MÁS la
// zona elegida, y se convierte acá. Mandar un ISO ya resuelto desde el cliente
// lo dejaría a merced de la zona del navegador de quien programa.
const scheduleSchema = z
  .object({
    local_datetime: z.string().trim().min(1),
    timezone: z.string().trim().min(1),
    recipients: z.array(z.object({
      member_id: z.string().nullish(),
      channel: z.enum(['whatsapp', 'email', 'interna']),
      recipient: z.string().optional(),
    })).default([]),
    /** Lista guardada de la que salieron los destinatarios, si es que salieron
     *  de una. El cron la vuelve a resolver al llegar la hora en vez de mandar
     *  a la foto de hoy (ver scheduleBroadcast). */
    list_id: z.uuid().nullish(),
  })
  .strict()

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = scheduleSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const cuando = resolveScheduledAt(parsed.data.local_datetime, parsed.data.timezone)
    if (!cuando.ok) {
      return NextResponse.json(
        { error: SCHEDULE_MESSAGES[cuando.error], code: cuando.error },
        { status: 400 },
      )
    }
    await scheduleBroadcast(id, parsed.data.recipients as Recipient[], cuando.iso, parsed.data.list_id)
    return NextResponse.json({ ok: true, scheduled_at: cuando.iso })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('EMAIL_NOT_CONFIGURED')) {
      return NextResponse.json(
        { error: 'El proveedor de email (SES) no está configurado. Revisá las variables SES_* del servidor.' },
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message === 'BROADCAST_YA_ENVIADO') {
      return NextResponse.json(
        { error: 'Este comunicado ya fue enviado o programado. Refrescá la página para ver su estado.' },
        { status: 409 },
      )
    }
    console.error('POST /api/communications/messages/[id]/schedule:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: cancela la programación y lo devuelve a borrador.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const cancelado = await unscheduleBroadcast(id)
    if (!cancelado) {
      return NextResponse.json(
        { error: 'El comunicado ya no está programado (puede que ya haya salido).' },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/communications/messages/[id]/schedule:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
