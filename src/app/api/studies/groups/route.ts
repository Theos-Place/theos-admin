import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import {
  getStudyGroups, createGroup, getPlanIdByCode, type GroupWriteInput,
} from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    const groups = await getStudyGroups()
    return NextResponse.json(groups)
  } catch (error) {
    console.error('GET /api/studies/groups:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const body = (await req.json()) as GroupWriteInput & { study_type_id?: string }
    // El frontend manda study_type_id (code); resolvemos a plan_id (UUID).
    if (!body.plan_id && body.study_type_id) {
      const planId = await getPlanIdByCode(body.study_type_id)
      if (!planId) {
        return NextResponse.json({ error: `Plan con code '${body.study_type_id}' no existe` }, { status: 400 })
      }
      body.plan_id = planId
    }
    const { study_type_id: _omit, ...input } = body
    const group = await createGroup(input)
    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/groups:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
