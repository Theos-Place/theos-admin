import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import {
  listInvitationsForPlan, createInvitation, revokeInvitation,
} from '@/lib/supabase/queries/study-invitations'

// GET ?plan_id=<uuid> → invitaciones del plan. Solo roles de estudios.
export async function GET(req: NextRequest) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const planId = req.nextUrl.searchParams.get('plan_id')
    if (!planId) return NextResponse.json({ error: 'Falta plan_id' }, { status: 400 })
    const invitations = await listInvitationsForPlan(planId)
    return NextResponse.json({ invitations })
  } catch (error) {
    console.error('GET /api/studies/invitations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST { member_id, plan_id, notes? } → crea invitación. Solo roles de estudios.
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const body = await req.json()
    if (!body?.member_id || !body?.plan_id) {
      return NextResponse.json({ error: 'Se requiere member_id y plan_id' }, { status: 400 })
    }
    const res = await createInvitation({
      member_id: body.member_id, plan_id: body.plan_id,
      invited_by: auth.ctx.memberId, notes: typeof body.notes === 'string' ? body.notes : null,
    })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/invitations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE ?id=<uuid> → revoca. Solo roles de estudios.
export async function DELETE(req: NextRequest) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
    await revokeInvitation(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/studies/invitations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
