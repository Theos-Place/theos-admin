import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { deactivateMember } from '@/lib/supabase/queries/members'
import { logAudit } from '@/lib/audit'

// Dar de baja (desactivar) a un MIEMBRO del sistema. Solo admin y comunicaciones
// (admin pasa siempre por requireRoles). No confundir con la baja de suscripción
// a email. Acción sensible: el cliente la confirma con un modal.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles('comunicaciones')
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    const body = (await req.json().catch(() => ({}))) as { reason?: string }
    const reason = body.reason?.trim() || 'baja_manual'
    await deactivateMember(id, reason, auth.ctx.memberId ?? id)
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'DEACTIVATE', entityType: 'members',
      entityId: id, newData: { reason },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/members/[id]/deactivate:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
