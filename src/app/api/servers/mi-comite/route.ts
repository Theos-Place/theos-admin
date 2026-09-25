import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { getManageableCommitteeIds } from '@/lib/supabase/queries/servers'
import { getMiComite } from '@/lib/supabase/queries/mi-comite'
import { comitesAConsultar } from '@/lib/servers/alcance-de-mi-comite'
import { reportarError } from '@/lib/observabilidad'
import { mandaEnAlgunComite } from '@/lib/auth/mando-de-comite'
import { puedeVerDonante, recortarDonante } from '@/lib/servers/visibilidad-de-donante'

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
  // Solo sesión: quién entra se decide abajo, y para eso hay que saber qué
  // comités encarga —o sea, consultar los puestos—.
  //
  // BUG 2026-09-22: el guard exigía el ROL `lider_comite`, y George Vivas
  // —encargado de dos comités— no lo tenía, así que recibía "acceso
  // restringido" en su propia pantalla. Encargar un comité se deriva de los
  // PUESTOS desde SRV-5; el rol es un dato aparte que se desincroniza. Manda
  // el puesto.
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const mios = auth.ctx.memberId ? await getManageableCommitteeIds(auth.ctx.memberId) : []
    const amplio = auth.ctx.roles.some(r => (SERVICE_ADMIN_ROLES as string[]).includes(r))
    if (!amplio && !mandaEnAlgunComite(mios)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const alcance = comitesAConsultar({ propios: mios, amplio }, req.nextUrl.searchParams.get('committee_id'))
    if (!alcance.ok) return NextResponse.json({ error: 'Ese comité no es tuyo.' }, { status: 403 })
    // SRV-10 · El dato de donante NO VIAJA al líder de comité. Se recorta acá y
    // no en la pantalla: esconder una columna deja el campo en el JSON, a un
    // clic de la pestaña de red. `verDonante` se manda también, para que la UI
    // sepa si tiene que dibujar la columna sin adivinarlo por la ausencia.
    const verDonante = puedeVerDonante(auth.ctx.roles)
    const comites = await Promise.all(alcance.comites.map(async id => {
      const { filas, ...resto } = await getMiComite(id)
      return { id, ...resto, filas: recortarDonante(filas, verDonante) }
    }))
    return NextResponse.json({ comites, verDonante })
  } catch (error) {
    reportarError('GET /api/servers/mi-comite:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
