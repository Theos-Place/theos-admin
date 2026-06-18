import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { listExceptionsForMember, createException } from '@/lib/supabase/queries/study-exceptions'

// GET /api/studies/exceptions?member_id=X → excepciones del miembro.
export async function GET(req: NextRequest) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId) return NextResponse.json({ error: 'Se requiere member_id' }, { status: 400 })
    return NextResponse.json(await listExceptionsForMember(memberId))
  } catch (error) {
    console.error('GET /api/studies/exceptions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/studies/exceptions → crea/actualiza una excepción activa.
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const body = await req.json() as {
      member_id?: string; plan_id?: string; waived_requirements?: string[]; reason?: string
    }
    if (!body.member_id || !body.plan_id) {
      return NextResponse.json({ error: 'Se requieren member_id y plan_id' }, { status: 400 })
    }
    const allowed = new Set(['donor', 'attendance', 'server', 'prerequisite', 'all'])
    const waived = (body.waived_requirements ?? []).filter(r => allowed.has(r))
    if (waived.length === 0) {
      return NextResponse.json({ error: 'Elegí al menos un requisito a eximir' }, { status: 400 })
    }
    const result = await createException({
      member_id: body.member_id,
      plan_id: body.plan_id,
      waived_requirements: waived,
      reason: body.reason ?? null,
      granted_by: auth.ctx.memberId,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/exceptions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
