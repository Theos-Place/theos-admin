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
 * LA REGLA: la pregunta solo tiene sentido cuando se llegó desde UNA ocurrencia
 * concreta (el calendario pasa ?date). Editando el evento en sí, el cambio es
 * del evento.
 *
 * Módulo PURO.
 */
export function hayQuePreguntarElAlcance(
  esRecurrente: boolean,
  /** ¿Se llegó desde una ocurrencia puntual? (el ?date de la URL) */
  hayOcurrenciaEnContexto: boolean,
): boolean {
  return esRecurrente && hayOcurrenciaEnContexto
}

/**
 * El alcance con el que se actúa cuando no se preguntó.
 *
 * 'all' sobre un evento no recurrente es simplemente "este evento": así lo
 * tratan `updateEventScoped` y `deleteEventScoped`.
 */
export const ALCANCE_SIN_PREGUNTAR = 'all' as const
