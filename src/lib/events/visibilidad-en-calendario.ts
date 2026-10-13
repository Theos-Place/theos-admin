/**
 * EVT-9 · Qué eventos ve una persona en su calendario.
 *
 * EL BUG (reportado el 2026-10-13): a alguien le comparten un evento privado,
 * se inscribe, y el evento no le aparece en el calendario. Medido en
 * producción: 2 eventos internos con 4 personas inscritas que no podían
 * verlos —«Volley» y «Aprendiendo a Extraer en la biblia todo su poder»—.
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
  // Interno: solo si ya está adentro.
  return !!e.already_registered || !!e.es_voluntario
}

/** El filtro, para usar directo en una lista. */
export function visiblesEnCalendario<T extends EventoParaCalendario>(
  eventos: readonly T[],
  opts: { gestiona: boolean },
): T[] {
  return eventos.filter(e => loVeEnSuCalendario(e, opts))
}
