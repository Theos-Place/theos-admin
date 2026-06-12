import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import {
  getStudyGroups, getStudyGroupsWithEnrollments, createGroup, getPlanIdByCode,
  type GroupWriteInput,
} from '@/lib/supabase/queries/studies'

// GET /api/studies/groups
//  - default: TODOS los grupos con enrollment_counts (sin enrollments embebidos
//    — C5 auditoría 2026-06-11: el payload pasaba de varios MB).
//  - ?page=N&pageSize=M (tope 200): { groups, total, page, pageSize }.
//  - ?include=enrollments: todos los grupos con enrollments (member_id, status),
//    para consumidores que necesitan los IDs (ej. RecipientSelector).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl

    if (searchParams.get('include') === 'enrollments') {
      return NextResponse.json(await getStudyGroupsWithEnrollments())
    }

    const rawPage = searchParams.get('page')
    const rawPageSize = searchParams.get('pageSize')
    if (rawPage === null && rawPageSize === null) {
      // Sin params: comportamiento histórico (array plano con todos los grupos).
      const { data } = await getStudyGroups()
      return NextResponse.json(data)
    }

    const pageNum = Number(rawPage ?? 1)
    const pageSizeNum = Number(rawPageSize ?? 50)
    const page = Number.isFinite(pageNum) ? Math.max(1, Math.trunc(pageNum)) : 1
    const pageSize = Number.isFinite(pageSizeNum) ? Math.min(200, Math.max(1, Math.trunc(pageSizeNum))) : 50

    const { data, total } = await getStudyGroups({ page, pageSize })
    return NextResponse.json({ groups: data, total, page, pageSize })
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
