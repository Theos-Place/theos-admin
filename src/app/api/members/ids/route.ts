import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { moduleScope } from '@/lib/auth/roles'
import { getMemberIds } from '@/lib/supabase/queries/members'
import { parseGroupsParam, parseOpsParam } from '@/lib/filter-units'

// GET: solo los IDs (y total) que coinciden con los filtros, sin paginar.
// Mismos params que /api/members. Para guardar listas / acciones sobre todo el filtro.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('miembros', { beyondOwn: true })
    // SEC-1: el PADRÓN completo exige alcance 'all' — lider_comite (scope
    // 'committee') pasaba el beyondOwn y podía listar/exportar todo; a su
    // gente la ve por /servidores (detalle del comité).
    if (auth.ctx && moduleScope(auth.ctx.roles, 'miembros') !== 'all') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl
    const search    = searchParams.get('search')   ?? undefined
    const is_active = searchParams.get('is_active')
    const is_donor  = searchParams.get('is_donor')
    const is_server = searchParams.get('is_server')
    const active_attendance = searchParams.get('active_attendance')

    // Filtros avanzados serializados como JSON (validados como array).
    let conditions
    const rawConditions = searchParams.get('conditions')
    if (rawConditions) {
      try {
        const parsed = JSON.parse(rawConditions)
        if (Array.isArray(parsed)) conditions = parsed
      } catch { /* condiciones malformadas → se ignoran */ }
    }

    const result = await getMemberIds({
      search,
      conditions,
      groups: parseGroupsParam(searchParams.get('groups')),
      topLevelOps: parseOpsParam(searchParams.get('ops')),
      is_active: is_active !== null ? is_active === 'true' : true,
      is_donor:  is_donor  !== null ? is_donor  === 'true' : undefined,
      is_server: is_server === 'true' ? true : undefined,
      active_attendance: active_attendance === 'estudios' ? 'estudios' as const : active_attendance === 'true' ? true : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/members/ids:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
