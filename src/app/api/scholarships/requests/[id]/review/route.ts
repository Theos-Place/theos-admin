import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { logAudit } from '@/lib/audit'
import { approveScholarshipRequest, rejectScholarshipRequest } from '@/lib/supabase/queries/scholarships'

// POST: revisa una solicitud de beca. Body:
//  { action: 'approve', discount_type, discount_value, approval_type: 'total'|'parcial' }
//  { action: 'reject', reason }
// El toggle total/parcial lo marca explícitamente quien aprueba — no se infiere.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleView('becas', { action: 'edit' })
  if (auth.res) return auth.res
  if (!auth.ctx.memberId) {
    return NextResponse.json({ error: 'Tu usuario no está vinculado a un perfil de miembro' }, { status: 409 })
  }
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })
    const body = await req.json()

    if (body?.action === 'approve') {
      const discountType = body?.discount_type
      if (discountType !== 'percentage' && discountType !== 'fixed') {
        return NextResponse.json({ error: 'Datos inválidos', detalles: { discount_type: 'debe ser percentage o fixed' } }, { status: 400 })
      }
      const discountValue = Number(body?.discount_value)
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        return NextResponse.json({ error: 'Datos inválidos', detalles: { discount_value: 'debe ser mayor a 0' } }, { status: 400 })
      }
      const approvalType = body?.approval_type
      if (approvalType !== 'total' && approvalType !== 'parcial') {
        return NextResponse.json({ error: 'Datos inválidos', detalles: { approval_type: 'debe ser total o parcial' } }, { status: 400 })
      }
      await approveScholarshipRequest(id, {
        discount_type: discountType, discount_value: discountValue, approval_type: approvalType,
        reviewerMemberId: auth.ctx.memberId, reviewerUserId: auth.ctx.userId,
      })
      await logAudit({ actorUserId: auth.ctx.userId, action: 'APPROVE', entityType: 'finance_requests', entityId: id, newData: { approval_type: approvalType } })
      return NextResponse.json({ ok: true })
    }

    if (body?.action === 'reject') {
      const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
      if (!reason) return NextResponse.json({ error: 'El motivo de rechazo es obligatorio.' }, { status: 400 })
      await rejectScholarshipRequest(id, { reason, reviewerId: auth.ctx.memberId })
      await logAudit({ actorUserId: auth.ctx.userId, action: 'REJECT', entityType: 'finance_requests', entityId: id, newData: { reason } })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
  } catch (error) {
    if (error instanceof Error && (error.message === 'Solicitud no encontrada' || error.message === 'La solicitud ya fue resuelta' || error.message === 'La solicitud no tiene un destino definido')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('POST /api/scholarships/requests/[id]/review:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
