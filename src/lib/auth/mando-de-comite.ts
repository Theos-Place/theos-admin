/**
 * Quién manda en un comité, y qué le da eso.
 *
 * DOS BUGS DEL 2026-09-22, y los dos salen del mismo desalineo: **el permiso
 * miraba el ROL `lider_comite` y la realidad vive en los PUESTOS.**
 *
 *  · Floriana Fonseca (lider_comite, dirigente) buscó a una persona cualquiera
 *    y le abrió la ficha completa. No debía poder.
 *  · George Vivas, encargado de DOS comités pero sin el rol, recibía "acceso
 *    restringido" en Mi comité. Sí debía poder.
 *
 * Ser encargado se deriva de tener un PUESTO de encargado en un comité activo
 * —eso ya lo fijó SRV-5, cuando `getManageableCommitteeIds` dejó de mirar
 * `areas.leader_id`—. El rol quedó como un resto que daba permisos por su
 * cuenta y se desincronizó con los puestos reales.
 *
 * LA REGLA, entonces:
 *   · Manda en un comité quien TIENE EL PUESTO, tenga o no el rol.
 *   · Eso le da su comité y la gente de su comité. NADA MÁS: ni el padrón, ni
 *     el export, ni la ficha de alguien que no es de su comité.
 *
 * Módulo puro: la consulta la hace el llamador, la decisión vive acá.
 */

/** ¿Esta sesión manda en al menos un comité? */
export function mandaEnAlgunComite(comitesQueGestiona: string[]): boolean {
  return comitesQueGestiona.length > 0
}

/**
 * ¿Puede ver la ficha de alguien POR SER ENCARGADO?
 *
 * Solo si comparten un comité de los que esa persona gestiona. Es el permiso
 * que el rol `lider_comite` decía tener —"Su comité y sus miembros"— y que en
 * la práctica no se verificaba contra nadie.
 */
export function puedeVerFichaPorComite(
  comitesQueGestiona: string[],
  comitesDeLaPersona: string[],
): boolean {
  if (comitesQueGestiona.length === 0) return false
  const mios = new Set(comitesQueGestiona)
  return comitesDeLaPersona.some(c => mios.has(c))
}

/**
 * EL ALCANCE SOBRE EL PADRÓN. `beyondOwn` significaba "cualquier alcance que no
 * sea `own`", y por eso el alcance `committee` de `lider_comite` abría el
 * padrón COMPLETO: la lista, el export, los conteos y la ficha de cualquiera.
 * Eran 29 personas con ese rol.
 *
 * El padrón es de quien tiene alcance `all` y de nadie más. Un alcance acotado
 * no es un padrón chiquito: es otra cosa, y se resuelve donde corresponde
 * (`puedeVerFichaPorComite`).
 */
export const ALCANCE_DE_PADRON = 'all'
