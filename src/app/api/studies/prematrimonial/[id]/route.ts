import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { createGroupForRequest, cancelPrematrimonialRequest } from '@/lib/supabase/queries/prematrimonial'

// PATCH: acciones del coordinador sobre una solicitud prematrimonial.
//  { action: 'create_group', group: {...} }  → crea grupo y asigna la pareja.
//  { action: 'cancel', reason?, with_refund? } → cancela (opcional: solicitud de devolución).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Estudios (crear grupo) + finanzas/admin (cancelar/devolución).
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin', 'finanzas')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    const actor = auth.ctx.memberId
    if (!actor) return NextResponse.json({ error: 'Actor no resuelto.' }, { status: 400 })
    const body = await req.json()

    if (body.action === 'create_group') {
      const g = body.group ?? {}
      if (!g.name || !g.leader_id) {
        return NextResponse.json({ error: 'El grupo requiere al menos nombre y dirigente.' }, { status: 400 })
      }
      const res = await createGroupForRequest(id, {
        name: String(g.name), leader_id: String(g.leader_id), co_leader_id: g.co_leader_id ?? null,
        zone: g.zone ?? null, schedule_days: Array.isArray(g.schedule_days) ? g.schedule_days : null,
        schedule_time: g.schedule_time ?? null, starts_at: g.starts_at ?? null, location: g.location ?? null,
      }, actor)
      return NextResponse.json({ ok: true, ...res })
    }

    if (body.action === 'cancel') {
      const res = await cancelPrematrimonialRequest(id, body.reason ?? null, !!body.with_refund, actor)
      return NextResponse.json({ ok: true, ...res })
    }

    return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'ESTADO_INVALIDO') return NextResponse.json({ error: 'La solicitud no está pendiente (ya tiene grupo o fue cancelada).' }, { status: 409 })
    if (msg === 'YA_CANCELADA') return NextResponse.json({ error: 'La solicitud ya está cancelada.' }, { status: 409 })
    if (msg === 'NO_ENCONTRADA') return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 })
    console.error('PATCH prematrimonial/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
