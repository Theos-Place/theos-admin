/**
 * ¿Este evento usa inscripción, para efectos de lo que se MUESTRA?
 *
 * Una charla no se inscribe: la gente llega. Pero la ficha enseñaba igual la
 * pestaña de inscripciones y la tasa de asistencia calculada contra inscritos,
 * y salían cosas como "187 de 0 inscritos" — un 0 que parece un dato y es solo
 * una división que no se debió hacer.
 *
 * EL CRITERIO VIVE ACÁ Y EN UN SOLO CAMPO: `requires_registration`, el mismo
 * que ya decide si aparece el botón público de inscribirse (EVE-1/EVE-3). Que
 * cada pantalla invente su propia condición es cómo se llega a que el botón
 * diga una cosa y la pestaña otra.
 *
 * LA EXCEPCIÓN QUE IMPORTA: un evento pudo tener inscripciones y que después
 * alguien le apagara la bandera. Esconder la pestaña ahí borraría de la vista
 * gente que SÍ se inscribió. Mientras existan inscripciones la pestaña se
 * queda, con un aviso de que el evento ya no las pide.
 *
 * Desde 2026-09-10 ese estado ya no se puede CREAR —apagar la bandera con
 * inscripciones encima se rechaza, ver puedeApagarInscripcion—, pero el aviso
 * se mantiene: si quedara alguno de antes, la pantalla lo explica en vez de
 * esconderlo.
 */

export type EventoParaInscripcion = {
  requires_registration: boolean
  /** Cuántas inscripciones tiene HOY, existan por lo que existan. */
  inscritos: number
}

/** ¿Se muestra la pestaña/sección de inscripciones? */
export function mostrarInscripciones(e: EventoParaInscripcion): boolean {
  return e.requires_registration || e.inscritos > 0
}

/** ¿Hay que avisar que el evento ya no pide inscripción pero conserva las que
 *  tenía? Es el único caso donde la pestaña aparece sin la bandera. */
export function esInscripcionHistorica(e: EventoParaInscripcion): boolean {
  return !e.requires_registration && e.inscritos > 0
}

export const AVISO_INSCRIPCION_HISTORICA =
  'Este evento ya no requiere inscripción. Se muestran las que se registraron antes.'

/**
 * Tasa de asistencia sobre inscritos. `null` cuando la pregunta no aplica —
 * porque el evento no pide inscripción o porque no hay inscritos.
 *
 * Devolver null y no 0 es la diferencia entre "no corresponde" y "nadie vino".
 * Con 0 la pantalla dibujaba un anillo vacío al 0% en una charla llena.
 */
export function tasaDeAsistencia(e: EventoParaInscripcion & { asistentes: number }): number | null {
  if (!e.requires_registration) return null
  if (e.inscritos <= 0) return null
  return Math.round((e.asistentes / e.inscritos) * 100)
}

/**
 * La línea que se lee bajo el número de asistencia.
 *
 * El encuadre lo da si el evento USA inscripción, no si el cálculo dio un
 * número: un evento que pide inscripción y no tuvo a nadie sigue midiéndose
 * contra inscritos —"0 de 0 inscritos" es una frase cierta y útil ahí—,
 * mientras que una charla no tiene contra qué medirse y solo dice cuánta gente
 * llegó. Lo que nunca aparece es un porcentaje inventado sobre cero.
 */
export function textoDeAsistencia(e: EventoParaInscripcion & { asistentes: number }): string {
  if (!e.requires_registration) {
    return `${e.asistentes} ${e.asistentes === 1 ? 'asistente' : 'asistentes'}`
  }
  return `${e.asistentes} de ${e.inscritos} ${e.inscritos === 1 ? 'inscrito' : 'inscritos'} asistieron`
}

/**
 * Lo que va en la columna "inscritos" de un export.
 *
 * Vacío —no '0'— cuando el evento no pide inscripción: un 0 en una hoja de
 * cálculo se lee como un dato y se suma en los totales.
 */
export function inscritosParaExport(e: EventoParaInscripcion): string {
  if (!e.requires_registration && e.inscritos === 0) return 'N/A'
  return String(e.inscritos)
}

export type ResultadoApagar =
  | { puede: true }
  | { puede: false; motivo: string }

/**
 * ¿Se puede apagar `requires_registration`?
 *
 * No, si ya hay gente inscrita. Apagarlo deja a esas personas en un evento que
 * dice no pedir inscripción: no aparecen donde se las busca, no reciben lo que
 * se le manda a los inscritos, y quien apagó la bandera no se entera de que las
 * dejó ahí. Si de verdad hay que apagarlo, primero se resuelven las
 * inscripciones — que es una decisión sobre personas, no sobre una casilla.
 */
export function puedeApagarInscripcion(inscritos: number): ResultadoApagar {
  if (inscritos <= 0) return { puede: true }
  return {
    puede: false,
    motivo: inscritos === 1
      ? 'Este evento ya tiene 1 persona inscrita. Para quitar la inscripción, primero hay que resolver esa inscripción.'
      : `Este evento ya tiene ${inscritos} personas inscritas. Para quitar la inscripción, primero hay que resolver esas inscripciones.`,
  }
}
