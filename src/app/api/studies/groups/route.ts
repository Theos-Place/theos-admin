import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { GROUP_ADMIN_ROLES } from '@/lib/auth/roles'
import { studiesViewScope } from '@/lib/auth/studies-scope'
import {
  getStudyGroups, getStudyGroupsWithEnrollments, createGroup, getPlanIdByCode, getStudyGroupZones,
} from '@/lib/supabase/queries/studies'
import { groupCreateSchema } from './schema'
import { validateEnrollmentDates } from '@/lib/studies/enrollment-window'
import { normalizeRestriction } from '@/lib/studies/group-restrictions'

// Roles que pueden listar grupos: los que gestionan grupos (STUDY_ADMIN +
// editor_grupos_estudio) + dirigentes, más los consumidores cross-módulo del
// listado (finanzas en sus solicitudes, comunicaciones para destinatarios,
// solo_lectura). 'miembro' queda fuera: el detalle del plan no es para ellos
// (defensa server-side, la UI ya lo oculta).
// SEC-1: el dirigente (scope 'own') recibe SOLO sus grupos (leader/co-leader).
// Bug 2026-08-04: 'editor_grupos_estudio' faltaba acá y el rol veía la página
// de grupos vacía (podía editar un grupo, pero no listarlos).
const GROUPS_LIST_ROLES = [...GROUP_ADMIN_ROLES, 'dirigente', 'finanzas', 'comunicaciones', 'solo_lectura'] as const

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

    // SEC-1: dirigente sin permisos más amplios → solo sus grupos. finanzas/
    // comunicaciones no tienen módulo estudios pero SÍ necesitan el listado
    // completo (por eso están en la allowlist y no se filtran acá).
    const leaderMemberId =
      studiesViewScope(auth.ctx.roles) === 'leader'
      && !auth.ctx.roles.some(r => r === 'finanzas' || r === 'comunicaciones')
        ? auth.ctx.memberId
        : null

    if (searchParams.get('include') === 'enrollments') {
      return NextResponse.json(await getStudyGroupsWithEnrollments({ leaderMemberId }))
    }

    // ?facet=zones → solo las zonas presentes en los grupos, para armar el filtro
    // del listado (ver src/lib/studies/group-zone-filter.ts).
    if (searchParams.get('facet') === 'zones') {
      return NextResponse.json(await getStudyGroupZones({ leaderMemberId }))
    }

    // Filtros del listado — viajan al servidor (status[], plan, zona, día, búsqueda).
    const statuses = searchParams.getAll('status')
    const filters = {
      leaderMemberId,
      statuses: statuses.length ? statuses : undefined,
      planCode: searchParams.get('plan') ?? undefined,
      zone: searchParams.get('zone') ?? undefined,
      zoneNull: searchParams.get('zone_null') === '1' || undefined,
      day: searchParams.get('day') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      noLeader: searchParams.get('no_leader') === '1' || undefined,
      closingSoon: searchParams.get('closing_soon') === '1' || undefined,
    }
    const hasFilter = statuses.length > 0 || filters.planCode || filters.zone || filters.zoneNull || filters.day || filters.search || filters.noLeader || filters.closingSoon

    // ?all=1 → set COMPLETO filtrado (para el export, sin paginar).
    if (searchParams.get('all') === '1') {
      const { data } = await getStudyGroups({ filters })
      return NextResponse.json(data)
    }

    const rawPage = searchParams.get('page')
    const rawPageSize = searchParams.get('pageSize')
    if (rawPage === null && rawPageSize === null && !hasFilter) {
      // Sin params ni filtros: comportamiento histórico (array plano con todos)
      // — filters igual viaja: lleva el scope del dirigente (SEC-1).
      const { data } = await getStudyGroups({ filters })
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
    const auth = await requireRoles(...GROUP_ADMIN_ROLES)
    if (auth.res) return auth.res
  try {
    const parsed = groupCreateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const { study_type_id, enrollment_restrictions: rawRestriction, ...rest } = parsed.data
    // GRU-2: se normaliza ANTES de tocar la base — lo que quede fuera del set
    // permitido no se guarda, y una restricción vacía se guarda como NULL.
    const input = 'enrollment_restrictions' in parsed.data
      ? { ...rest, enrollment_restrictions: normalizeRestriction(rawRestriction) }
      : rest
    // GRU-1: coherencia de la ventana de matrícula.
    const dateError = validateEnrollmentDates(input)
    if (dateError) return NextResponse.json({ error: dateError, code: 'fechas_matricula' }, { status: 400 })
    // El frontend manda study_type_id (code); resolvemos a plan_id (UUID).
    if (!input.plan_id && study_type_id) {
      const planId = await getPlanIdByCode(study_type_id)
      if (!planId) {
        return NextResponse.json({ error: `Plan con code '${study_type_id}' no existe` }, { status: 400 })
      }
      input.plan_id = planId
    }
    const group = await createGroup(input)
    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'DIRIGENTE_NO_RECOMENDADO') {
      return NextResponse.json(
        { error: 'El dirigente o co-dirigente elegido está marcado como no recomendado para dar estudios.' },
        { status: 400 },
      )
    }
    console.error('POST /api/studies/groups:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
