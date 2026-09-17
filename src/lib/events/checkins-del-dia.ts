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
 *
 * EL PARÁMETRO LLEGA EN DOS FORMATOS y aceptar uno solo fue un bug: el
 * calendario y la lista de check-in mandan el `start_at` completo
 * ("2026-09-09T01:00:00.000Z"), no un YYYY-MM-DD. Con la versión que solo
 * aceptaba la fecha corta, abrir la ocurrencia del 8 de setiembre caía en el
 * `else` y mostraba HOY: cero check-ins en un evento que tenía 189.
 *
 * Un ISO completo se convierte a su día CIVIL en hora de Costa Rica, no se
 * corta con slice(0,10): una charla de las 7 p.m. viaja como la 1 a.m. UTC del
 * día siguiente y cortar el string daría el día equivocado.
 */
export function diaQueSeEstaViendo(
  paramFecha: string | null,
  esRecurrente: boolean,
  hoyYmd: string,
): string | null {
  if (!esRecurrente) return null
  if (paramFecha) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(paramFecha)) return paramFecha
    const dia = diaCR(paramFecha)
    if (dia) return dia
  }
  return hoyYmd
}

/**
 * Con qué fecha se muestra una asistencia en el historial de una persona.
 *
 * EL BUG (2026-09-17). El historial usaba `events.starts_at`, y en un evento
 * RECURRENTE esa es el ancla de la serie: la misma para todas las ocurrencias.
 * Floriana veía dos veces la charla del 8 de setiembre y ninguna del 15 — eran
 * sus dos asistencias a "Charla Meridiano Martes", pintadas las dos con la
 * fecha de la serie.
 *
 * En un evento recurrente manda el instante del CHECK-IN, que es el único dato
 * que distingue una semana de otra. En uno que pasa una sola vez sigue mandando
 * `starts_at`: ahí el check-in puede haberse digitado al día siguiente y la
 * fecha del evento es la correcta.
 */
export function fechaDeLaAsistencia(input: {
  esRecurrente: boolean | null | undefined
  /** `events.starts_at`. */
  inicioDelEvento: string | null | undefined
  /** `event_checkins.checked_in_at`. */
  marcadoEn: string
}): string {
  if (input.esRecurrente) return input.marcadoEn
  return input.inicioDelEvento ?? input.marcadoEn
}
