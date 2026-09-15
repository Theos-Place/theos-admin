/**
 * Qué check-ins corresponden a ESTA ocurrencia de un evento.
 *
 * Un evento recurrente es UNA fila con una regla (WEEKLY:TUE), no una fila por
 * semana, y todos sus check-ins cuelgan de esa misma fila. La pantalla los
 * mostraba todos juntos: el 15 de setiembre la Charla Meridiano Martes decía
 * 189 asistentes y eran los de la semana anterior.
 *
 * Peor que el número: la pantalla usa esa lista para decidir si alguien "ya
 * estaba registrado". Con la lista de todas las semanas, quien vino una vez no
 * podía volver a marcar nunca. (El índice único de la BD tenía el mismo
 * defecto y se arregló en la migración 20260915120000.)
 *
 * Un evento NO recurrente no se filtra: pasa una sola vez, todos sus check-ins
 * son suyos, y filtrar por fecha escondería los que se digitaron al día
 * siguiente — que es un caso real y frecuente con las personas nuevas.
 */

/** Fecha civil (YYYY-MM-DD) de un instante, en hora de Costa Rica (UTC-6). */
export function diaCR(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  return new Date(t - 6 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export type CheckinConFecha = { checked_at: string }

/**
 * @param esRecurrente  si el evento se repite; si no, no se filtra nada.
 * @param diaDeLaOcurrencia  YYYY-MM-DD de la ocurrencia que se está viendo.
 */
export function checkinsDeLaOcurrencia<T extends CheckinConFecha>(
  todos: T[],
  esRecurrente: boolean,
  diaDeLaOcurrencia: string | null,
): T[] {
  if (!esRecurrente || !diaDeLaOcurrencia) return todos
  return todos.filter(c => diaCR(c.checked_at) === diaDeLaOcurrencia)
}

/**
 * Qué día se está viendo: el de la URL (?date=) si viene, y si no HOY.
 *
 * Hoy y no la fecha de inicio del evento: un recurrente arrancó hace meses y
 * quien abre la pantalla sin parámetro está parado en la charla de hoy, no en
 * la primera de la serie.
 */
export function diaQueSeEstaViendo(
  paramFecha: string | null,
  esRecurrente: boolean,
  hoyYmd: string,
): string | null {
  if (!esRecurrente) return null
  if (paramFecha && /^\d{4}-\d{2}-\d{2}$/.test(paramFecha)) return paramFecha
  return hoyYmd
}
