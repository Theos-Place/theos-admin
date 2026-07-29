import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { groupViewerScope } from '@/lib/auth/studies-scope'
import { getGroupSessions, getGroupLeaderIds, isMemberOfGroup } from '@/lib/supabase/queries/studies'

// GET: sesiones de asistencia de un grupo (con conteo de presentes).
// SEC-1: estudios más allá de 'own', el dirigente DE ESTE grupo, o un miembro
// inscrito en él (su vista read-only muestra las sesiones); el resto 403.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    const leaders = await getGroupLeaderIds(id)
    if (!leaders) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    const scope = groupViewerScope({
      roles: auth.ctx.roles,
      memberId: auth.ctx.memberId,
      group: leaders,
      isEnrolled: auth.ctx.memberId ? await isMemberOfGroup(id, auth.ctx.memberId) : false,
    })
    if (scope === 'none') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    return NextResponse.json(await getGroupSessions(id))
  } catch (error) {
    console.error('GET /api/studies/groups/[id]/sessions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
