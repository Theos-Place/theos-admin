import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getManageableCommitteeIds } from '@/lib/supabase/queries/servers'
import { getMiComite } from '@/lib/supabase/queries/mi-comite'
import { comitesAConsultar } from '@/lib/servers/alcance-de-mi-comite'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET: la gente de MIS comités y el estado de sus compromisos (SRV-4).
 *
 * Solo `lider_comite` (y admin, que pasa siempre en requireRoles). Ni
 * coordinador_servidores ni dirección: esta pantalla es la vista del encargado
 * sobre su propia gente, y ellos ya tienen el padrón completo por otro lado.
 *
 * El recorte NO se negocia con la UI: los comités salen de
 * `getManageableCommitteeIds`, o sea de la estrella de SRV-5. Un `committee_id`
 * que no esté en esa lista da 403 aunque exista.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRoles('lider_comite')
  if (auth.res) return auth.res
  try {
    const mios = auth.ctx.memberId ? await getManageableCommitteeIds(auth.ctx.memberId) : []
    const alcance = comitesAConsultar(mios, req.nextUrl.searchParams.get('committee_id'))
    if (!alcance.ok) return NextResponse.json({ error: 'Ese comité no es tuyo.' }, { status: 403 })
    const comites = await Promise.all(alcance.comites.map(async id => ({ id, ...(await getMiComite(id)) })))
    return NextResponse.json({ comites })
  } catch (error) {
    reportarError('GET /api/servers/mi-comite:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
