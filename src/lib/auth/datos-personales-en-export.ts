/**
 * FRM-6 · Quién puede sumarle datos personales al export de respuestas.
 *
 * NO ES EL MISMO PERMISO QUE VER LAS RESPUESTAS. Ver un formulario lo habilita
 * `formViewerScope`, que incluye el acceso puntual por `form_access_grants` y
 * al encargado del evento — gente que puede leer las respuestas de SU
 * formulario sin tener nada que ver con el padrón. El checkbox agrega cédulas,
 * fechas de nacimiento, correos y **datos de salud** (alergias) de cualquiera
 * que haya respondido, y eso es el padrón entrando por otra puerta.
 *
 * ASÍ QUE PIDE LO MISMO QUE EL EXPORT DEL PADRÓN: alcance `all` sobre miembros
 * Y la acción `export`. No es un criterio nuevo — es el de
 * `/api/members/export`, escrito una vez y usado por los dos. Si mañana se
 * aprieta allá, se aprieta acá solo.
 *
 * Y SE VALIDA EN EL SERVIDOR, no solo escondiendo el checkbox. Esa distinción
 * la aprendió este repo en PAR-4 (2026-09-23): el export del padrón guardaba
 * solo por alcance y siete roles sin permiso —incluido `solo_lectura`— podían
 * bajarse 24.000 fichas pegándole al endpoint, porque el proxy excluye `/api`.
 * No veían el botón. El botón nunca fue el permiso.
 */

import type { RoleId } from '@/types/auth'
import { moduleScope, hasModulePermission } from './roles'

export function puedeExportarDatosPersonales(
  roles: readonly RoleId[] | null | undefined,
): boolean {
  const lista = [...(roles ?? [])] as RoleId[]
  if (lista.length === 0) return false
  return moduleScope(lista, 'miembros') === 'all'
    && hasModulePermission(lista, 'miembros', 'export')
}
