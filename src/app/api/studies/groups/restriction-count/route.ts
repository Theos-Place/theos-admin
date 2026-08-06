import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { GROUP_ADMIN_ROLES } from '@/lib/auth/roles'
import { normalizeRestriction, restrictionSummary } from '@/lib/studies/group-restrictions'
import { countMembersMatchingRestriction } from '@/lib/supabase/queries/group-restrictions'

// GRU-2 · Cuánta gente del padrón cumpliría esta restricción.
//
// Es el número que se ve mientras se arma la restricción: una condición
// demasiado estrecha se nota ahí, no cuando nadie se matriculó. POST porque la
// restricción es un objeto (conditions + groups + ops), no cabe en la URL.
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles(...GROUP_ADMIN_ROLES)
    if (auth.res) return auth.res
    const body = await req.json().catch(() => null)
    const restriction = normalizeRestriction((body as { restriction?: unknown } | null)?.restriction)
    const count = await countMembersMatchingRestriction(restriction)
    return NextResponse.json({ count, summary: restrictionSummary(restriction) })
  } catch (error) {
    console.error('POST /api/studies/groups/restriction-count:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
