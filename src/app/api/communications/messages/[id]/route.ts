import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { deleteBroadcast, broadcastDeleteErrorResponse } from '@/lib/supabase/queries/communications'

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
    console.error('DELETE /api/communications/messages/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
