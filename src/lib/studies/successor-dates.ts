/**
 * Cuándo empieza y termina el grupo SUCESOR.
 *
 * Regla del negocio (2026-08-31): la cohorte que aprueba sigue de una — el
 * grupo nuevo arranca donde terminó el anterior, sin hueco. Vale para toda la
 * cadena: N1→N2→N3→N4 y DIS1→DIS2→DIS3.
 *
 * Hasta hoy el sucesor se creaba SIN fechas. Cuatro grupos quedaron así
 * (dos DIS2 y dos N3, 29 personas cursando): no rompía nada a la vista, pero
 * sin fecha de inicio nadie sabe cuándo le toca cerrar y el recordatorio de
 * cierre —que se calcula sobre la fecha de fin— no les llega nunca.
 *
 * La convención de fechas sale de los datos, no de una suposición: los grupos
 * de junio van 2026-06-01 → 2026-08-10 con un plan de 10 semanas, y
 * 2026-06-01 → 2026-08-17 con uno de 11. O sea `ends_at = starts_at +
 * semanas·7`, y es el fin del PERÍODO, no la última sesión. Por eso arrancar el
 * sucesor exactamente en `ends_at` del anterior no solapa nada.
 */

const MS_DIA = 86_400_000

/** YYYY-MM-DD + n días, en UTC. Las fechas de grupo son días, no instantes:
 *  hacer la cuenta en hora local movería el día en Costa Rica (UTC-6). */
export function sumarDias(ymd: string, dias: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`)
  if (!Number.isFinite(t)) throw new Error(`fecha inválida: ${ymd}`)
  return new Date(t + dias * MS_DIA).toISOString().slice(0, 10)
}

export function fechasDelSucesor(input: {
  /** `ends_at` del grupo que se está cerrando (YYYY-MM-DD). */
  finDelAnterior: string | null | undefined
  /** `duration_weeks` del plan del sucesor. */
  semanas: number | null | undefined
  /** Con qué arrancar si el anterior no tiene fecha de fin: el día del cierre. */
  hoy: string
}): { starts_at: string; ends_at: string | null } {
  const inicio = (input.finDelAnterior ?? '').slice(0, 10) || input.hoy
  const semanas = Number(input.semanas)
  // Sin duración conocida no se inventa un fin: la fecha de inicio ya alcanza
  // para saber cuándo empezó, y un fin falso dispararía el recordatorio de
  // cierre en una fecha que nadie acordó.
  if (!Number.isFinite(semanas) || semanas <= 0) return { starts_at: inicio, ends_at: null }
  return { starts_at: inicio, ends_at: sumarDias(inicio, Math.round(semanas) * 7) }
}
