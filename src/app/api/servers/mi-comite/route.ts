import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { getComitesQueAbrenMiComite } from '@/lib/supabase/queries/servers'
import { getMiComite } from '@/lib/supabase/queries/mi-comite'
import { comitesAConsultar } from '@/lib/servers/alcance-de-mi-comite'
import { reportarError } from '@/lib/observabilidad'

/**
 * GET: la gente de un comité y el estado de sus compromisos (SRV-4 / SRV-6).
 *
 * Dos audiencias. Quien tiene un puesto que abre la pantalla ve LOS SUYOS y
 * nada más: el recorte no se negocia con la UI, los comités salen de
 * `getComitesQueAbrenMiComite` y un `committee_id` fuera de esa lista da 403
 * aunque el comité exista. Los roles amplios (staff, coordinación de
 * servidores, dirección, admin) eligen cualquiera con el selector y ven
 * exactamente lo mismo que vería su encargado (SRV-6, 2026-09-21).
 *
 * SRV-16 (2026-09-30) · La lista dejó de ser solo la estrella de SRV-5: ahora
 * también la abre el anfitrión de su sede. OJO CON LA FUNCIÓN QUE SE LLAMA
 * ACÁ — `getManageableCommitteeIds`, la de antes, sigue existiendo y significa
 * otra cosa (quién MANDA en el comité); cambiarla por esta en los otros tres
 * endpoints que la usan le daría al anfitrión poder para pedir puestos y abrir
 * fichas.
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
    const mios = auth.ctx.memberId ? await getComitesQueAbrenMiComite(auth.ctx.memberId) : []
    const amplio = auth.ctx.roles.some(r => (SERVICE_ADMIN_ROLES as string[]).includes(r))
    // Ya no se pregunta `mandaEnAlgunComite`: mandar y mirar dejaron de ser lo
    // mismo con SRV-16, y ese helper sigue significando MANDAR en `guard.ts`.
    if (!amplio && mios.length === 0) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const alcance = comitesAConsultar({ propios: mios, amplio }, req.nextUrl.searchParams.get('committee_id'))
    if (!alcance.ok) return NextResponse.json({ error: 'Ese comité no es tuyo.' }, { status: 403 })
    /**
     * SRV-16 · EL DATO DE DONANTE VIAJA COMPLETO, también al líder de comité.
     *
     * SRV-10 lo recortaba acá por orden de dirección del 2026-09-24, mientras
     * definían cómo se usaba. Ya se definió (Floriana, 2026-09-30): el líder
     * lo ve. Se quitó el recorte entero —el módulo `visibilidad-de-donante` y
     * la bandera `verDonante` que la pantalla leía—, en vez de dejar una
     * función que siempre devuelve `true`: una compuerta abierta que nadie
     * vuelve a cerrar es una compuerta que confunde al que la lee.
     */
    const comites = await Promise.all(alcance.comites.map(async id => ({
      id, ...await getMiComite(id),
    })))
    return NextResponse.json({ comites })
  } catch (error) {
    reportarError('GET /api/servers/mi-comite:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
