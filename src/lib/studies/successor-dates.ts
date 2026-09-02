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
 *
 * SEMANA DE VACACIONES (2026-08-31, pedido del usuario): al período se le suma
 * una semana más que las que dura el plan. Los grupos no encadenan pegados —
 * entre uno y otro hay un respiro—, y como el sucesor arranca en el `ends_at`
 * del anterior, meter la semana en el fin del período la reparte sola por toda
 * la cadena sin tener que tocar las fechas de inicio.
 *
 * CIERRE TARDÍO (2026-09-02): "arranca donde terminó el anterior" daba una
 * fecha en el PASADO cuando el grupo se cerraba tarde. El Nivel 3 de Jhonny
 * Leandro terminó el 10 de agosto y se cerró el 1 de setiembre, así que el
 * Nivel 4 nació "empezando" el 10 de agosto — tres semanas antes de existir.
 *
 * REGLA ACTUAL (2026-09-02, pedido del usuario). El sucesor arranca el próximo
 * día de clase que caiga a 8 días o más del cierre:
 *
 *   · 8 días es lo que tardan los folletos en llegar a la sede
 *     (FOLLETO_LEAD_DAYS), así que el grupo no empieza sin material.
 *   · Y tiene que caer en un día en que ese estudio se imparte: si el grupo es
 *     los miércoles, arrancar un jueves no significa nada.
 *
 * Ejemplo real: el Nivel 3 de Floriana se cerró el miércoles 2 de setiembre.
 * Ocho días después es el 10, jueves; como el grupo es de miércoles, el
 * sucesor arranca el miércoles 16.
 *
 * Si el grupo anterior todavía no había terminado, el sucesor no se le monta
 * encima: se corre al primer día de clase después de ese fin.
 */

/** La pausa entre un estudio y el siguiente, en semanas. */
export const SEMANAS_DE_VACACIONES = 1

/** Días mínimos entre el cierre y el arranque del sucesor: lo que tardan los
 *  folletos en estar en la sede. */
export const DIAS_MINIMOS_PARA_ARRANCAR = 8

const MS_DIA = 86_400_000

/** Código de `schedule_days` → día de la semana de JS (0 = domingo). */
const DIA_SEMANA: Record<string, number> = {
  D: 0, L: 1, M: 2, X: 3, J: 4, V: 5, S: 6,
}

/** Qué día de la semana cae un YYYY-MM-DD, en UTC. */
function diaDeLaSemana(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay()
}

/**
 * El primer día EN QUE SE IMPARTE el estudio que caiga en `desde` o después.
 *
 * Sin días configurados devuelve `desde` tal cual: no se inventa un horario
 * que nadie definió, y mover la fecha por una suposición sería peor que
 * dejarla donde está.
 */
export function proximoDiaDeClase(desde: string, dias: readonly string[] | null | undefined): string {
  const validos = (dias ?? []).map(d => DIA_SEMANA[d]).filter(d => d !== undefined)
  if (validos.length === 0) return desde
  const objetivo = new Set(validos)
  // Como mucho una semana: en 7 días se pasa por todos los días posibles.
  for (let i = 0; i < 7; i++) {
    const cand = sumarDias(desde, i)
    if (objetivo.has(diaDeLaSemana(cand))) return cand
  }
  return desde
}

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
  /** El día del cierre: desde acá se cuentan los 8 días. */
  hoy: string
  /** `schedule_days` del grupo (L/M/X/J/V/S/D). El arranque cae en uno de
   *  estos días. */
  diasDeClase?: readonly string[] | null
}): { starts_at: string; ends_at: string | null } {
  // Piso: 8 días desde el cierre, y nunca encima del grupo anterior.
  // Comparación de strings YYYY-MM-DD: ordenan igual que las fechas y no
  // arrastran husos horarios.
  const porFolletos = sumarDias(input.hoy, DIAS_MINIMOS_PARA_ARRANCAR)
  const finAnterior = (input.finDelAnterior ?? '').slice(0, 10)
  const piso = finAnterior && finAnterior > porFolletos ? finAnterior : porFolletos
  const inicio = proximoDiaDeClase(piso, input.diasDeClase)
  const semanas = Number(input.semanas)
  // Sin duración conocida no se inventa un fin: la fecha de inicio ya alcanza
  // para saber cuándo empezó, y un fin falso dispararía el recordatorio de
  // cierre en una fecha que nadie acordó.
  if (!Number.isFinite(semanas) || semanas <= 0) return { starts_at: inicio, ends_at: null }
  return { starts_at: inicio, ends_at: sumarDias(inicio, (Math.round(semanas) + SEMANAS_DE_VACACIONES) * 7) }
}
