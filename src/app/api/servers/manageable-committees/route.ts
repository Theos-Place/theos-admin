import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { isGlobalServiceAdmin } from '@/lib/auth/committee-scope'
import { getManageableCommitteeIds } from '@/lib/supabase/queries/servers'

// Comités para los que el usuario puede solicitar vacantes/puestos.
//  { all: true } → roles administrativos globales (cualquier comité).
//  { all: false, ids } → solo los comités que coordina o cuya área lidera.
export async function GET() {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const all = isGlobalServiceAdmin(auth.ctx.roles)
    const ids = all ? [] : (auth.ctx.memberId ? await getManageableCommitteeIds(auth.ctx.memberId) : [])
    return NextResponse.json({ all, ids })
  } catch (error) {
    console.error('GET /api/servers/manageable-committees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
