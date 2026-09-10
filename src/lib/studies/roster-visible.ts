/**
 * Quién se ve en la lista de participantes de un grupo.
 *
 * EL PROBLEMA (2026-09-10). El encabezado decía "7 inscritos de 10 lugares" y
 * la tabla de abajo mostraba 8 filas: contaba bien pero pintaba de más. La
 * octava era Mariela Meléndez, que se había pasado a otro grupo. Alguien mira
 * la lista, cuenta 8, y cree que el cupo está más lleno de lo que está.
 *
 * La regla: por defecto se ven los que están; los retirados se piden. No se
 * borran de la vista para siempre —hace falta saber quién pasó por el grupo—
 * pero tampoco compiten con los que sí están.
 */
export type ParticipanteVisible = { status: string }

/** Los que están: incluye pendientes de pago y en revisión, que todavía
 *  cuentan como gente del grupo. Solo se van los retirados. */
export function participantesActivos<T extends ParticipanteVisible>(todos: readonly T[]): T[] {
  return todos.filter(p => p.status !== 'withdrawn')
}

export function participantesRetirados<T extends ParticipanteVisible>(todos: readonly T[]): T[] {
  return todos.filter(p => p.status === 'withdrawn')
}

/** La lista que se pinta, según si se pidieron los retirados. */
export function participantesVisibles<T extends ParticipanteVisible>(
  todos: readonly T[],
  mostrarRetirados: boolean,
): T[] {
  return mostrarRetirados ? [...todos] : participantesActivos(todos)
}

/** El texto del botón. null = no hay retirados, así que no se ofrece nada:
 *  un botón que revela cero filas solo confunde. */
export function textoBotonRetirados(cuantos: number, mostrando: boolean): string | null {
  if (cuantos <= 0) return null
  if (mostrando) return 'Ocultar retirados'
  return cuantos === 1 ? 'Ver 1 retirado' : `Ver ${cuantos} retirados`
}
