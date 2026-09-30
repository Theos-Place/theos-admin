/**
 * Quién recibe el TELÉFONO del dirigente en el listado de grupos.
 *
 * Pedido de Floriana el 2026-09-30: sumarlo como columna seleccionable del
 * export de grupos. El dato ya existía en la ficha del grupo; lo que no
 * existía era mandarlo en la LISTA, y ahí está el cuidado.
 *
 * **QUIÉN LO RECIBE SE MIDIÓ, no se dedujo leyendo `roles.ts`** — y hubo que
 * medirlo dos veces, porque las dos primeras versiones de este comentario
 * estaban mal. La primera decía que `comunicaciones` y `finanzas` no tenían
 * nada que ver con el padrón: los dos declaran `miembros` con alcance total.
 * La segunda decía que `solo_lectura` quedaba afuera: tiene
 * `{ module: 'all', scope: 'all' }`, un comodín que un grep de
 * `module: 'miembros'` no encuentra.
 *
 * Corriendo la función sobre los nueve roles que listan grupos, los que NO
 * reciben el teléfono son exactamente dos: **`editor_grupos_estudio`** y
 * **`dirigente`** (que además solo ve SUS grupos, donde el dirigente es él).
 * Para los otros siete esto no abre nada: ya ven el directorio completo.
 *
 * O sea que hoy el recorte casi no recorta. Se deja igual porque es la red
 * para el día que alguien sume un rol a `GROUPS_LIST_ROLES` sin padrón — que
 * es como el rol `reportes` estuvo a punto de llevarse los contactos por la
 * puerta de un reporte en REP-5.
 *
 * Así que se aplica el criterio QUE YA EXISTE en esos dos endpoints, en vez
 * de inventar un tercero: el contacto exige el módulo `miembros` con alcance
 * TOTAL. Quien no lo tiene recibe la lista sin el campo —no viaja al
 * navegador— y en el archivo la columna sale vacía.
 *
 * Módulo PURO.
 */
import { hasModulePermission, moduleScope } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

/** ¿Esta sesión puede ver el teléfono de un dirigente en el listado? */
export function puedeVerTelefonoDelDirigente(roles: readonly string[] | null | undefined): boolean {
  if (!roles) return false
  const r = roles as RoleId[]
  return hasModulePermission(r, 'miembros', 'view') && moduleScope(r, 'miembros') === 'all'
}

/**
 * Quita los teléfonos de la lista cuando no corresponde verlos.
 *
 * Opera sobre la forma de la BASE (`leader.phone` anidado), que es lo que
 * devuelve el endpoint: el aplanado a `leader_phone` lo hace el adaptador en
 * el cliente, o sea DESPUÉS. Recortar el nombre plano no habría quitado nada.
 *
 * BORRA LA PROPIEDAD en vez de ponerla en `null`: un `null` viaja igual y se
 * lee como «no tiene teléfono», que es una afirmación distinta y falsa.
 */
type ConTelefono = { phone?: string | null } | null | undefined

export function recortarTelefonos<T extends { leader?: ConTelefono; co_leader?: ConTelefono }>(
  grupos: readonly T[],
  visible: boolean,
): T[] {
  if (visible) return [...grupos]
  const sinTel = (p: ConTelefono): ConTelefono => {
    if (!p) return p
    const copia = { ...p }
    delete copia.phone
    return copia
  }
  return grupos.map(g => ({ ...g, leader: sinTel(g.leader), co_leader: sinTel(g.co_leader) }))
}
