import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { puedeSolicitarParaCualquierComite } from '@/lib/auth/committee-scope'
import { getManageableCommitteeIds } from '@/lib/supabase/queries/servers'
import { reportarError } from '@/lib/observabilidad'

// Comités para los que el usuario puede solicitar vacantes/puestos.
//  { all: true } → roles administrativos globales (cualquier comité).
//  { all: false, ids } → solo los comités que coordina o cuya área lidera.
export async function GET() {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    // SRV-11: `solicitudes_puestos` también ve todos los comités — llena la
    // solicitud en lugar del líder. Ve todos, pero no por eso se salta la
    // ventana: eso lo decide `isGlobalServiceAdmin` aparte.
    const all = puedeSolicitarParaCualquierComite(auth.ctx.roles)
    const ids = all ? [] : (auth.ctx.memberId ? await getManageableCommitteeIds(auth.ctx.memberId) : [])
    return NextResponse.json({ all, ids })
  } catch (error) {
    reportarError('GET /api/servers/manageable-committees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
