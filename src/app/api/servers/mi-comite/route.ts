import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { getManageableCommitteeIds } from '@/lib/supabase/queries/servers'
import { getMiComite } from '@/lib/supabase/queries/mi-comite'
import { comitesAConsultar } from '@/lib/servers/alcance-de-mi-comite'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET: la gente de un comité y el estado de sus compromisos (SRV-4 / SRV-6).
 *
 * Dos audiencias. El `lider_comite` ve LOS SUYOS y nada más: el recorte no se
 * negocia con la UI, los comités salen de `getManageableCommitteeIds` —o sea de
 * la estrella de SRV-5— y un `committee_id` fuera de esa lista da 403 aunque el
 * comité exista. Los roles amplios (staff, coordinación de servidores,
 * dirección, admin) eligen cualquiera con el selector y ven exactamente lo
 * mismo que vería su encargado (SRV-6, 2026-09-21).
 */
export async function GET(req: NextRequest) {
  const auth = await requireRoles('lider_comite', ...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const mios = auth.ctx.memberId ? await getManageableCommitteeIds(auth.ctx.memberId) : []
    const amplio = auth.ctx.roles.some(r => (SERVICE_ADMIN_ROLES as string[]).includes(r))
    const alcance = comitesAConsultar({ propios: mios, amplio }, req.nextUrl.searchParams.get('committee_id'))
    if (!alcance.ok) return NextResponse.json({ error: 'Ese comité no es tuyo.' }, { status: 403 })
    const comites = await Promise.all(alcance.comites.map(async id => ({ id, ...(await getMiComite(id)) })))
    return NextResponse.json({ comites })
  } catch (error) {
    reportarError('GET /api/servers/mi-comite:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
