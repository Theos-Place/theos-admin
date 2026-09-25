/**
 * PAR-5b · Negar una condición del padrón.
 *
 * Cada condición se resuelve a dos listas de conjuntos de ids, y el evaluador
 * pregunta: `include.every(s => s.has(id)) && exclude.every(s => !s.has(id))`.
 * Darlas vuelta invierte la condición EXACTA, sea cual sea — por eso la
 * negación no vive en los quince `case` sino acá, en una función de cuatro
 * líneas que todos atraviesan al cerrar.
 *
 * DÓNDE SE ROMPE: vale mientras cada condición aporte UN SOLO conjunto. Con dos
 * en `include`, negar sería ¬(A∧B) = ¬A ∨ ¬B, y el intercambio da ¬A ∧ ¬B, que
 * es más estricto y devolvería de menos sin avisar. Hay un test que cuenta los
 * `push` de `resolveAdvancedConditions` para que nadie agregue el segundo sin
 * enterarse.
 *
 * Módulo PURO: no sabe de Supabase ni de tipos de condición.
 */

export type CondicionResuelta = {
  include: Array<Set<string>>
  exclude: Array<Set<string>>
  isActiveOverride?: boolean
}

/**
 * `isActiveOverride` también se invierte.
 *
 * Sale de la condición `status`, que además de su conjunto pone una bandera que
 * cambia el `is_active` de la consulta BASE. Si se negara el conjunto y no la
 * bandera, la consulta base seguiría buscando justo lo contrario de lo que se
 * pide y el resultado saldría vacío.
 */
export function negarCondicion(r: CondicionResuelta): CondicionResuelta {
  return {
    include: r.exclude,
    exclude: r.include,
    isActiveOverride: r.isActiveOverride === undefined ? undefined : !r.isActiveOverride,
  }
}

/**
 * La misma pregunta que hace el evaluador, para poder probar la negación sin
 * levantar media base de datos. Si esto y `getMemberIds` se separan, el test
 * deja de significar algo — por eso está escrito igual, a propósito.
 */
export function pasaLaCondicion(r: CondicionResuelta, id: string): boolean {
  return r.include.every(s => s.has(id)) && r.exclude.every(s => !s.has(id))
}
