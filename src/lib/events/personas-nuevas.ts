/**
 * Cuántas de las personas que hicieron check-in son NUEVAS: esta es la PRIMERA
 * vez que aparecen en cualquier evento.
 *
 * LA REGLA CAMBIÓ (2026-09-10). Antes eran dos condiciones: ficha creada el
 * mismo día del evento Y primer check-in. La primera se cayó por un caso real:
 * Victoria Badilla llegó nueva a la charla de Meridiano del 8-sep, pero el
 * check-in falló por un bug de permisos y su ficha se creó DOS DÍAS DESPUÉS, al
 * repararlo. El reporte decía "0 personas nuevas" en una charla donde sí hubo
 * una. La fecha de creación de la ficha mide cuándo la escribimos nosotros, no
 * cuándo llegó la persona.
 *
 * Queda una sola condición, que es la que responde la pregunta de verdad: este
 * evento es el PRIMER check-in de esa persona. Con eso:
 *   · quien llegó por primera vez cuenta, aunque su ficha se haya creado antes
 *     (una carga masiva vieja) o después (una reparación);
 *   · quien ya venía no cuenta, aunque le hayamos creado la ficha ese día;
 *   · en un día con seis charlas, la persona cuenta UNA sola vez, en aquella a
 *     la que de verdad llegó primero.
 *
 * CONTRAPARTIDA, dicha en voz alta: ahora también cuenta quien tenía ficha desde
 * hace años por una carga masiva y viene a su primera charla. Es deliberado —
 * para la sede esa persona ES nueva—, pero significa que el número no es
 * "fichas creadas hoy".
 *
 * EL DÍA ES EL DE COSTA RICA, no el UTC. Una charla que arranca a las 7:00pm CR
 * cae en el día siguiente en UTC. Se conserva diaCR porque otras pantallas lo
 * usan.
 */

/** Costa Rica es UTC-6 fijo. Mismo criterio que expand-recurrence. */
const CR_OFFSET_MS = 6 * 60 * 60 * 1000

/** La fecha civil (YYYY-MM-DD) de un instante, en hora de Costa Rica. */
export function diaCR(iso: string): string | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t - CR_OFFSET_MS).toISOString().slice(0, 10)
}

export type CheckinParaConteo = {
  member_id: string
  /** Cuándo ocurrió ESTE check-in. */
  checked_at?: string | null
  /** created_at de la ficha. null cuando el check-in es de un invitado sin ficha. */
  member_created_at?: string | null
  /**
   * El primer check-in de esa persona en TODO el sistema (RPC
   * members_first_checkin). Solo lo llena el detalle del evento.
   *
   * Si viene `undefined` —una pantalla que no lo pidió— la condición no se
   * aplica y queda solo la de la fecha. Es explícito a propósito: preferimos
   * degradar al conteo viejo antes que dar 0 en silencio.
   */
  member_first_checkin_at?: string | null
}

export type ConteoNuevos = {
  /** Personas distintas para las que este es su primer check-in. */
  nuevas: number
  /** Personas distintas con check-in y ficha (el denominador del porcentaje). */
  conFicha: number
  /** Porcentaje redondeado; 0 si no hay nadie con ficha. */
  porcentaje: number
}

/**
 * ¿Este check-in es el de una persona que vino por primera vez?
 *
 * `dia` es la fecha civil CR del evento. Los instantes se comparan en epoch, no
 * como texto: el mismo instante puede venir escrito distinto (`+00:00` contra
 * `Z`, o con otra precisión de milisegundos) según de dónde salga.
 */
function esPersonaNueva(c: CheckinParaConteo, dia: string | null): boolean {
  if (!c.member_id) return false
  // Sin el dato del primer check-in no se puede responder. Se cae al criterio
  // viejo —ficha creada ese día— en vez de devolver 0 en silencio: una pantalla
  // que no pidió el dato da un número aproximado, no un cero engañoso.
  if (c.member_first_checkin_at === undefined) {
    return !!dia && !!c.member_created_at && diaCR(c.member_created_at) === dia
  }
  if (!c.member_first_checkin_at || !c.checked_at) return false
  return Date.parse(c.member_first_checkin_at) === Date.parse(c.checked_at)
}

/**
 * `referencia` es el instante del evento (starts_at). Se usa su día en Costa
 * Rica, no "hoy": así el número de un evento pasado no cambia con el tiempo.
 *
 * Cuenta PERSONAS, no filas: alguien registrado en el evento general y en un
 * subevento tendría dos check-ins pero es una sola persona nueva. (Hoy la base
 * lo impide con UNIQUE(member_id, event_id), pero el conteo no depende de eso.)
 */
export function contarPersonasNuevas(
  checkins: CheckinParaConteo[],
  referencia: string,
): ConteoNuevos {
  const dia = diaCR(referencia)
  const conFicha = new Set<string>()
  const nuevas = new Set<string>()
  for (const c of checkins) {
    if (!c.member_id) continue
    conFicha.add(c.member_id)
    if (esPersonaNueva(c, dia)) nuevas.add(c.member_id)
  }
  return {
    nuevas: nuevas.size,
    conFicha: conFicha.size,
    porcentaje: conFicha.size === 0 ? 0 : Math.round((nuevas.size / conFicha.size) * 100),
  }
}
