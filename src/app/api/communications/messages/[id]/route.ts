import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { deleteBroadcast, broadcastDeleteErrorResponse, updateDraftBroadcast } from '@/lib/supabase/queries/communications'
import { z } from 'zod'
import { reportarError } from '@/lib/observabilidad'

// DELETE: borra un comunicado en BORRADOR. Un programado hay que cancelarlo
// antes (vuelve a borrador) y uno que ya salió no se borra nunca: es el
// registro de a quién le llegó. La regla completa está en
// src/lib/communications/borrado-de-comunicado.ts.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
    await deleteBroadcast(id)
    // Se audita porque no hay papelera: sin esta línea, un borrador que
    // desaparece no deja forma de saber quién lo sacó.
    await logAudit({
      actorUserId: auth.ctx.userId,
      action: 'DELETE',
      entityType: 'message_broadcasts',
      entityId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const res = broadcastDeleteErrorResponse(error)
    if (res) return res
    reportarError('DELETE /api/communications/messages/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH: guarda los cambios de un BORRADOR sobre sí mismo.
//
// POR QUÉ EXISTE (2026-10-01): "Continuar editando" guardaba con POST, o sea
// que cada vez creaba un comunicado NUEVO. Editar un borrador tres veces
// dejaba tres borradores y la persona tenía que adivinar cuál era el bueno.
//
// Solo borradores. Reescribir el cuerpo de algo ya enviado rompería lo único
// que dice qué recibió la gente; un programado se cancela primero, igual que
// para borrarlo.
const draftPatchSchema = z
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
    const parsed = draftPatchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 },
      )
    }
    const tocado = await updateDraftBroadcast(id, parsed.data)
    if (!tocado) {
      // No se distingue "no existe" de "ya no es borrador" a propósito: en los
      // dos casos lo que la persona tiene que hacer es volver a la lista.
      return NextResponse.json(
        { error: 'Ese comunicado ya no es un borrador: refrescá la lista.', code: 'no_es_borrador' },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('PATCH /api/communications/messages/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
