import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import {
  getStudyGroups, getStudyGroupsWithEnrollments, createGroup, getPlanIdByCode,
  type GroupWriteInput,
} from '@/lib/supabase/queries/studies'

// Roles que pueden listar todos los grupos: los de estudios + dirigentes, más
// los consumidores cross-módulo del listado (finanzas en sus solicitudes,
// comunicaciones para destinatarios, solo_lectura). 'miembro' queda fuera: el
// detalle del plan no es para ellos (defensa server-side, la UI ya lo oculta).
const GROUPS_LIST_ROLES = [...STUDY_ADMIN_ROLES, 'dirigente', 'finanzas', 'comunicaciones', 'solo_lectura'] as const

// GET /api/studies/groups
//  - default: TODOS los grupos con enrollment_counts (sin enrollments embebidos
//    — C5 auditoría 2026-06-11: el payload pasaba de varios MB).
//  - ?page=N&pageSize=M (tope 200): { groups, total, page, pageSize }.
//  - ?include=enrollments: todos los grupos con enrollments (member_id, status),
//    para consumidores que necesitan los IDs (ej. RecipientSelector).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles(...GROUPS_LIST_ROLES)
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl

    if (searchParams.get('include') === 'enrollments') {
      return NextResponse.json(await getStudyGroupsWithEnrollments())
    }

    // Filtros del listado — viajan al servidor (status[], plan, zona, día, búsqueda).
    const statuses = searchParams.getAll('status')
    const filters = {
      statuses: statuses.length ? statuses : undefined,
      planCode: searchParams.get('plan') ?? undefined,
      zone: searchParams.get('zone') ?? undefined,
      day: searchParams.get('day') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      noLeader: searchParams.get('no_leader') === '1' || undefined,
    }
    const hasFilter = statuses.length > 0 || filters.planCode || filters.zone || filters.day || filters.search || filters.noLeader

    // ?all=1 → set COMPLETO filtrado (para el export, sin paginar).
    if (searchParams.get('all') === '1') {
      const { data } = await getStudyGroups({ filters })
      return NextResponse.json(data)
    }

    const rawPage = searchParams.get('page')
    const rawPageSize = searchParams.get('pageSize')
    if (rawPage === null && rawPageSize === null && !hasFilter) {
      // Sin params ni filtros: comportamiento histórico (array plano con todos).
      const { data } = await getStudyGroups()
      return NextResponse.json(data)
    }

    const pageNum = Number(rawPage ?? 1)
    const pageSizeNum = Number(rawPageSize ?? 50)
    const page = Number.isFinite(pageNum) ? Math.max(1, Math.trunc(pageNum)) : 1
    const pageSize = Number.isFinite(pageSizeNum) ? Math.min(200, Math.max(1, Math.trunc(pageSizeNum))) : 50

    const { data, total } = await getStudyGroups({ page, pageSize, filters })
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
