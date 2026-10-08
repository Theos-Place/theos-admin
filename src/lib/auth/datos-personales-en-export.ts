/**
 * FRM-6 · Quién puede sumarle datos personales al export de respuestas.
 *
 * EL CHECKBOX EXISTE PARA ESTO: quien organiza un campamento necesita las
 * ALERGIAS de los que se apuntaron. Negárselo no protege a nadie — hace que
 * pida la lista por WhatsApp, que es peor.
 *
 * EL BUG (Floriana, 2026-10-07): al encargado de campas no le aparecía
 * nunca. El formulario se le COMPARTE por `form_access_grants`, baja las
 * respuestas sin problema… y el checkbox no, porque el único camino era el
 * del PADRÓN (alcance total sobre miembros + `export`), que él no tiene ni
 * tiene por qué tener.
 *
 * SON DOS CAMINOS Y SE SUMAN. No se reemplazó el viejo: `coordinador_dirigentes`
 * y `editor_perfiles` llegan por el padrón y NO tienen `formularios:export`
 * (medido el 2026-10-07), así que cambiar una regla por la otra les habría
 * quitado en silencio algo que ya usaban.
 *
 *   A · POR EL PADRÓN — alcance `all` sobre miembros y la acción `export`.
 *       Es el mismo criterio de `/api/members/export`: quien puede bajarse
 *       el padrón entero no gana nada nuevo al ver una ficha acá.
 *
 *   B · POR EL FORMULARIO — tener derecho a bajar LAS RESPUESTAS DE ESE
 *       formulario, con un matiz:
 *         · `grantee` y `event_manager` entran: llevan esa actividad y es
 *           para eso que se les compartió.
 *         · `admin` (módulo formularios) entra SOLO CON LA ACCIÓN `export`.
 *
 * POR QUÉ B NO ES «EL PADRÓN POR OTRA PUERTA», que es lo que decía el
 * razonamiento viejo. Medido: `getFichasPersonalesParaExport` recibe
 * EXACTAMENTE los `member_id` de quienes respondieron ESE formulario. Quien
 * lo baja ya les ve nombre, teléfono y respuestas; lo que se suma es la
 * ficha de esa misma gente, no la de los 24.000 del padrón.
 *
 * Y POR QUÉ IGUAL SE LE PIDE `export` AL CAMINO A DEL MÓDULO: `solo_lectura`
 * tiene `view` sobre formularios y no tiene `export`. Es justo el rol que
 * PAR-4 (2026-09-23) señaló por poder bajarse 24.000 fichas sin permiso.
 * Sigue viendo las respuestas; cédulas, nacimientos y alergias no.
 *
 * Y SE VALIDA EN EL SERVIDOR, no solo escondiendo el checkbox. Esa distinción
 * la aprendió este repo en el mismo PAR-4: no veían el botón, y el endpoint
 * les respondía igual. El botón nunca fue el permiso.
 */

import type { RoleId } from '@/types/auth'
import { moduleScope, hasModulePermission } from './roles'
import type { FormViewerScope } from './forms-scope'

/** Camino A: quien puede bajarse el padrón entero. No depende del formulario. */
export function puedeExportarElPadron(
  roles: readonly RoleId[] | null | undefined,
): boolean {
  const lista = [...(roles ?? [])] as RoleId[]
  if (lista.length === 0) return false
  return moduleScope(lista, 'miembros') === 'all'
    && hasModulePermission(lista, 'miembros', 'export')
}

export function puedeExportarDatosPersonales(input: {
  roles: readonly RoleId[] | null | undefined
  /** El alcance sobre ESTE formulario, de `formViewerScope`. */
  scope: FormViewerScope
}): boolean {
  // Sin acceso a las respuestas no hay nada que discutir, venga por donde venga.
  if (input.scope === 'none') return false
  if (puedeExportarElPadron(input.roles)) return true
  if (input.scope === 'grantee' || input.scope === 'event_manager') return true
  return hasModulePermission([...(input.roles ?? [])] as RoleId[], 'formularios', 'export')
}
