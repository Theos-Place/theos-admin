/**
 * PRE-8 / EST · Quién puede cerrar un grupo, y por lo tanto quién puede ver
 * lo que el cierre necesita.
 *
 * EL BUG QUE ARREGLA (2026-10-13). El endpoint de cierre dejaba cerrar a
 * coordinación, dirección, admin Y al dirigente o co-dirigente del grupo. El
 * endpoint que carga las parejas del cierre decía en su comentario «mismos
 * roles que pueden CERRAR el grupo» y listaba solo los tres primeros.
 *
 * Resultado: Floriana, co-dirigente de su grupo prematrimonial, podía abrir
 * el cierre y cerrarlo, pero recibía 403 al cargar las parejas. La pantalla
 * mostraba «No se pudieron cargar las parejas del grupo» sin decir que era
 * un permiso, y el cierre quedaba sin la evaluación que debía recoger.
 *
 * Eran dos listas para la misma pregunta, escritas en dos archivos. Acá hay
 * una.
 *
 * Módulo PURO.
 */

/** Roles que pueden cerrar CUALQUIER grupo. */
export const ROLES_QUE_CIERRAN = [
  'coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin',
] as const

export function puedeCerrarPorRol(roles: readonly string[] | null | undefined): boolean {
  return (roles ?? []).some(r => (ROLES_QUE_CIERRAN as readonly string[]).includes(r))
}

/**
 * ¿Puede esta persona cerrar ESTE grupo?
 *
 * Quien lo dirige puede cerrar el suyo aunque no tenga rol de coordinación:
 * es quien estuvo ahí y quien sabe cómo le fue a cada quien.
 */
export function puedeCerrarEsteGrupo(input: {
  roles: readonly string[] | null | undefined
  memberId: string | null | undefined
  grupo: { leader_id: string | null; co_leader_id: string | null } | null
}): boolean {
  if (puedeCerrarPorRol(input.roles)) return true
  if (!input.memberId || !input.grupo) return false
  return input.grupo.leader_id === input.memberId
    || input.grupo.co_leader_id === input.memberId
}
