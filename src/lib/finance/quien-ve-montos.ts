/**
 * Quién ve los MONTOS de las donaciones. Una sola lista.
 *
 * EL BUG QUE ARREGLA (reportado por Floriana, 2026-10-14). El reporte de
 * «Donantes y montos» dejaba pasar a finanzas, dirección y admin, pero el
 * listado de donaciones decidía con `roles.includes('finanzas')`: un admin sin
 * el rol finanzas veía ₡22,8 millones en el reporte y «Sin monto» en cada fila
 * de la lista. Dos pantallas, dos reglas, y la misma persona.
 *
 * `admin` va EXPLÍCITO: `requireRoles` lo deja pasar siempre, pero un
 * `includes` no sabe eso — que es justo como se coló el bug.
 */
import type { RoleId } from '@/types/auth'

export const ROLES_QUE_VEN_MONTOS_DE_DONACION = ['finanzas', 'direccion', 'admin'] as const satisfies readonly RoleId[]

export function veMontosDeDonacion(roles: readonly string[]): boolean {
  return ROLES_QUE_VEN_MONTOS_DE_DONACION.some(r => roles.includes(r))
}
