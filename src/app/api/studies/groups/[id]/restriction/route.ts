import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { GROUP_ADMIN_ROLES } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validate'
import { restrictionSummary } from '@/lib/studies/group-restrictions'
import { getGroupRestriction, countMembersMatchingRestriction } from '@/lib/supabase/queries/group-restrictions'

// GRU-2 · La restricción de audiencia GUARDADA de un grupo, para poder editarla.
// El listado de grupos solo lleva `has_restriction` (el detalle no le sirve a la
// matrícula y engorda el payload); acá va completa, con su resumen y su conteo.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRoles(...GROUP_ADMIN_ROLES)
    if (auth.res) return auth.res
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    const restriction = await getGroupRestriction(id)
    const count = await countMembersMatchingRestriction(restriction)
    return NextResponse.json({ restriction, count, summary: restrictionSummary(restriction) })
  } catch (error) {
    console.error('GET /api/studies/groups/[id]/restriction:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
