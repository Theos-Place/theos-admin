/**
 * EVT-9 · Qué eventos ve una persona en su calendario.
 *
 * EL BUG (reportado el 2026-10-13): a alguien le comparten un evento privado
 * y no le aparece en el calendario.
 *
 * COMPARTIR TIENE DOS FORMAS, y la primera versión de este módulo solo
 * cubrió una:
 *   · ENCARGADO (`event_managers`) — gestiona el evento entero:
 *     inscripciones, check-in, todos los tabs. Es lo que se usa para
 *     «compartirle» un evento a alguien.
 *   · INSCRITO — se apuntó, y ve el detalle.
 * Las dos tienen que ver el evento en su calendario. Medido en producción:
 * 4 personas inscritas en 2 eventos internos y 3 encargadas de uno —entre
 * ellas quien reportó el bug, que es encargada y NO está inscrita, que es
 * justo el caso que se escapó—.
 *
 * LA CONFUSIÓN QUE LO CAUSÓ: «interno» se estaba leyendo como «escondido
 * para todos». No es lo mismo. Un evento interno NO SE ANUNCIA —no sale en
 * la cartelera pública ni en el listado general—, pero quien ya está adentro
 * tiene que poder encontrarlo. Esconderle a alguien algo a lo que SE
 * INSCRIBIÓ no protege nada: ya sabe que existe, ya tiene el link, y lo
 * único que logra es que no pueda ver la hora ni el lugar.
 *
 * Módulo PURO.
 */

export type EventoParaCalendario = {
  /** `false` = interno: no se anuncia. */
  is_public?: boolean | null
  /** ¿Esta persona ya se inscribió? */
  already_registered?: boolean | null
  /** ¿Sirve como voluntaria en este evento? */
  es_voluntario?: boolean | null
  /** ¿Está en `event_managers` de este evento? Lo gestiona entero. */
  es_encargado?: boolean | null
}

/**
 * ¿Le toca ver este evento en SU calendario?
 *
 * `gestiona` corta antes que todo: quien administra eventos los ve todos,
 * que es de lo que se trata administrarlos.
 */
export function loVeEnSuCalendario(
  e: EventoParaCalendario,
  opts: { gestiona: boolean },
): boolean {
  if (opts.gestiona) return true
  // `undefined` cuenta como público: es lo que hace el resto del sistema con
  // los eventos viejos, anteriores a que existiera la columna.
  if (e.is_public !== false) return true
  // Interno: solo si ya está adentro, de cualquiera de las tres maneras.
  return !!e.es_encargado || !!e.already_registered || !!e.es_voluntario
}

/** El filtro, para usar directo en una lista. */
export function visiblesEnCalendario<T extends EventoParaCalendario>(
  eventos: readonly T[],
  opts: { gestiona: boolean },
): T[] {
  return eventos.filter(e => loVeEnSuCalendario(e, opts))
}
