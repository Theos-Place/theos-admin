import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { logAudit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { getMemberIds, getMembersByIds } from '@/lib/supabase/queries/members'
import { parseGroupsParam, parseOpsParam } from '@/lib/filter-units'

// GET: devuelve TODOS los miembros que coinciden con los filtros (sin paginar),
// para exportar. Mismos params que /api/members. Usa createAdminClient (en getMembers).
// Mismo gate que el listado del padrón: módulo miembros con scope ≠ own
// (auditoría S1; antes pedía roles de estudios, inconsistente con quién ve el padrón).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('miembros', { beyondOwn: true })
    if (auth.res) return auth.res
    // Exporta el padrón completo: 5 corridas por minuto por usuario es de sobra.
    if (!rateLimit(`export:${auth.ctx.userId}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Demasiadas exportaciones, esperá un momento' }, { status: 429 })
    }
    const { searchParams } = req.nextUrl
    const search    = searchParams.get('search')   ?? undefined
    const is_active = searchParams.get('is_active')
    const is_donor  = searchParams.get('is_donor')
    const is_server = searchParams.get('is_server')
    const active_attendance = searchParams.get('active_attendance')

    // Filtros avanzados serializados como JSON (validados como array).
    let conditions: import('@/types/filters').FilterCondition[] | undefined
    const rawConditions = searchParams.get('conditions')
    if (rawConditions) {
      try {
        const parsed = JSON.parse(rawConditions)
        if (Array.isArray(parsed)) conditions = parsed
      } catch { /* condiciones malformadas → se ignoran */ }
    }

    // PostgREST corta cada respuesta en ~1000 filas, así que una sola query
    // con pageSize gigante truncaría el padrón en silencio. getMemberIds
    // pagina hasta agotar y getMembersByIds enriquece en chunks.
    const { ids, total } = await getMemberIds({
      search,
      conditions,
      groups: parseGroupsParam(searchParams.get('groups')),
      topLevelOps: parseOpsParam(searchParams.get('ops')),
      is_active: is_active !== null ? is_active === 'true' : true,
      is_donor:  is_donor  !== null ? is_donor  === 'true' : undefined,
      is_server: is_server === 'true' ? true : undefined,
      active_attendance: active_attendance === 'true' ? true : undefined,
    })
    const members = await getMembersByIds(ids)

    // Rastro de auditoría: exportar el padrón (PII de miles de personas) debe
    // registrar quién, con qué filtros y cuántos registros (Ley 8968).
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'EXPORT', entityType: 'members',
      newData: {
        total,
        filters: {
          search: search ?? null, is_active, is_donor, is_server, active_attendance,
          conditions: conditions?.length ?? 0,
        },
      },
    })

    return NextResponse.json({ members, total })
  } catch (error) {
    console.error('GET /api/members/export:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
