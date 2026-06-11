import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { updateStudyRequestStatus } from '@/lib/supabase/queries/study-requests'

const ACTIONS: Record<string, 'in_review' | 'resolved' | 'rejected'> = {
  take: 'in_review',
  resolve: 'resolved',
  reject: 'rejected',
}

// PATCH: { action: 'take' | 'resolve' | 'reject', review_notes? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes')
    if (auth.res) return auth.res
    if (!auth.ctx.memberId) {
      return NextResponse.json({ error: 'Tu usuario no está vinculado a un perfil de miembro' }, { status: 409 })
    }

    const { id } = await params
    const body = await req.json()
    const status = ACTIONS[body?.action as string]
    if (!status) {
      return NextResponse.json({ error: 'action debe ser take, resolve o reject' }, { status: 400 })
    }

    const updated = await updateStudyRequestStatus(
      id, status, auth.ctx.memberId,
      typeof body?.review_notes === 'string' ? body.review_notes.trim() || null : null,
    )
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/studies/requests/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
