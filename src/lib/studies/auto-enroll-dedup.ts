/**
 * A quién SÍ y a quién NO matricular en el nivel siguiente al cerrar (módulo puro).
 *
 * El dedup original saltaba a cualquiera que ya tuviera una inscripción al
 * nivel siguiente en 'enrolled', 'pendiente_de_pago', 'completed' o 'waitlist'.
 * Metía dos cosas distintas en el mismo balde:
 *
 *  · YA ESTÁ ADENTRO (enrolled / pendiente_de_pago / waitlist) — matricularlo
 *    otra vez crea un duplicado. Ese era el bug que el dedup vino a arreglar
 *    (A12: 3 duplicados en producción) y sigue vigente.
 *
 *  · YA LO APROBÓ (completed) — no es un duplicado: es alguien que está
 *    llevando el estudio de nuevo. Saltarlo lo deja fuera de su propio grupo,
 *    sin matrícula y sin folleto, y a alguien le toca arreglarlo a mano.
 *
 * Pasó de verdad (2026-09-02): Jessica Sibaja volvió a llevar el Nivel 3 con
 * Jhonny Leandro. Aprobó, pero como tenía el Nivel 4 aprobado desde 2022 el
 * dedup la excluyó, y hubo que matricularla a mano. Repetir un nivel no es raro
 * — ella misma tiene el N1 y el N2 aprobados dos veces cada uno.
 *
 * Así que 'completed' ya no bloquea: se matricula y se deja escrito por qué,
 * para que quien mire la inscripción no crea que es un error.
 */

/** Estados que significan "ya está adentro del nivel siguiente". */
export const ESTADOS_ACTIVOS = ['enrolled', 'pendiente_de_pago', 'waitlist'] as const

/** Los estados que hay que consultar para decidir: los activos y 'completed'. */
export const ESTADOS_A_CONSULTAR = [...ESTADOS_ACTIVOS, 'completed'] as const

export type DecisionMatricula =
  /** Se matricula normal. */
  | { accion: 'matricular'; repite: false }
  /** Se matricula, y se anota que está repitiendo el nivel. */
  | { accion: 'matricular'; repite: true; nota: string }
  /** Ya está adentro: matricularlo otra vez sería un duplicado. */
  | { accion: 'saltar'; motivo: 'ya_matriculado' }

export function decidirMatricula(input: {
  /** ¿Tiene una inscripción ACTIVA al nivel siguiente? */
  yaActivo: boolean
  /** ¿Tiene el nivel siguiente APROBADO de antes? */
  yaAprobado: boolean
}): DecisionMatricula {
  if (input.yaActivo) return { accion: 'saltar', motivo: 'ya_matriculado' }
  if (input.yaAprobado) {
    return {
      accion: 'matricular',
      repite: true,
      nota: 'Repite el nivel: ya lo tenía aprobado de antes',
    }
  }
  return { accion: 'matricular', repite: false }
}

/** Reparte una lista de miembros según la decisión, en un solo paso.
 *  Devuelve los que se matriculan (con su nota, si repiten) y los que se saltan. */
export function repartirParaMatricula(
  memberIds: readonly string[],
  activos: ReadonlySet<string>,
  aprobados: ReadonlySet<string>,
): {
  matricular: Array<{ memberId: string; nota: string | null }>
  saltados: string[]
} {
  const matricular: Array<{ memberId: string; nota: string | null }> = []
  const saltados: string[] = []
  for (const memberId of memberIds) {
    const d = decidirMatricula({ yaActivo: activos.has(memberId), yaAprobado: aprobados.has(memberId) })
    if (d.accion === 'saltar') saltados.push(memberId)
    else matricular.push({ memberId, nota: d.repite ? d.nota : null })
  }
  return { matricular, saltados }
}
