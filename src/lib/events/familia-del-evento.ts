/**
 * CHK-4 · Los comités que operan la PUERTA de un evento.
 *
 * EL PROBLEMA (reportado 2026-09-21): la bienvenida de Youth no podía hacer
 * check-in. En la puerta de una charla hay dos estaciones —la de la sede y la
 * de Youth— y la gente se marca en cualquiera de las dos. Pero el permiso de
 * EVE-12 se evalúa contra los comités del EVENTO, y el de Youth es un SUBEVENTO
 * dentro de la charla de la sede: el comité organizador registrado era la sede
 * y Youth no aparecía por ningún lado.
 *
 * LA REGLA: para la puerta, el alcance se mide sobre la FAMILIA — los comités
 * del evento más el de cada uno de sus subeventos. Quien opera una estación
 * opera las dos, en las dos direcciones.
 *
 * DÓNDE **NO** SE APLICA, y es lo importante: la lista de comités del evento
 * decide además quién cuenta como SERVIDOR para el precio y la exención
 * (`eventPricingFor`). Por eso el comité del subevento no se copia a esa lista
 * —convertiría a todo Comité Youth en servidor de la charla de Pedregal para
 * efectos de cobro— sino que se une aparte, y solo para el alcance de puerta.
 * Editar el evento sigue midiéndose con la lista angosta, como en EVE-12.
 */

/** Comités del evento ∪ comité de cada subevento, sin repetir ni vacíos. */
export function comitesDeLaPuerta(
  comitesDelEvento: readonly string[],
  comitesDeSubeventos: readonly (string | null | undefined)[],
): string[] {
  const ids = new Set<string>()
  for (const c of comitesDelEvento) if (c) ids.add(c)
  for (const c of comitesDeSubeventos) if (c) ids.add(c)
  return [...ids]
}
