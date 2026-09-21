/**
 * ¿Hay que preguntar "solo esta instancia / esta y futuras / toda la serie"?
 *
 * EL BUG (producción, 2026-09-21). Se preguntaba SIEMPRE que el evento fuera
 * recurrente, incluso entrando por la página del evento sin ninguna ocurrencia
 * en contexto. Ahí "solo esta instancia" no tiene respuesta correcta —¿cuál
 * instancia?— y el código inventaba una: la fecha de inicio del propio evento.
 *
 * Con el diálogo preseleccionado en "solo esta instancia", cambiar la fecha y
 * guardar creaba un evento HIJO en la fecha nueva y dejaba el original en la
 * vieja. Y borrar escribía una excepción para esa fecha, dejando la fila donde
 * estaba: "no deja borrarlo".
 *
 * LA REGLA. La pregunta solo tiene sentido cuando hay algo ANTES de la
 * ocurrencia que se está tocando. Hacen falta dos cosas:
 *
 *  1. Haber llegado desde una ocurrencia concreta (el calendario pasa ?date).
 *     Editando el evento en sí, el cambio es del evento.
 *
 *  2. Que esa ocurrencia NO sea la PRIMERA de la serie. En la primera las tres
 *     respuestas son la misma o son basura: "esta y las siguientes" son todas,
 *     y "solo esta" crea un evento hijo que duplica al padre. Segundo reporte
 *     del 2026-09-21 —"cuando lo edito lo duplica y luego no puedo borrar el
 *     duplicado"—: estaban editando la primera fecha de una copia recién hecha
 *     y eligieron "esta y las siguientes", que parte la serie en dos eventos.
 *
 * Módulo PURO.
 */
export function hayQuePreguntarElAlcance(
  esRecurrente: boolean,
  /** ¿Se llegó desde una ocurrencia puntual? (el ?date de la URL) */
  hayOcurrenciaEnContexto: boolean,
  /** ¿Esa ocurrencia es la primera de la serie? */
  esLaPrimeraOcurrencia = false,
): boolean {
  return esRecurrente && hayOcurrenciaEnContexto && !esLaPrimeraOcurrencia
}

/**
 * ¿La fecha que se está tocando es la primera de la serie?
 *
 * Se comparan solo los DÍAS: la ocurrencia llega del calendario con la hora de
 * su celda y el evento con la suya, y un desfase de horas no cambia que sea la
 * misma fecha.
 */
export function esLaPrimeraOcurrencia(
  inicioDelEvento: string | null | undefined,
  fechaDeLaOcurrencia: string | null | undefined,
): boolean {
  if (!inicioDelEvento || !fechaDeLaOcurrencia) return false
  return inicioDelEvento.slice(0, 10) === fechaDeLaOcurrencia.slice(0, 10)
}

/**
 * El alcance con el que se actúa cuando no se preguntó.
 *
 * 'all' sobre un evento no recurrente es simplemente "este evento": así lo
 * tratan `updateEventScoped` y `deleteEventScoped`.
 */
export const ALCANCE_SIN_PREGUNTAR = 'all' as const
