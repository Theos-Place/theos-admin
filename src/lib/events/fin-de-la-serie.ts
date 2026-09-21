/**
 * Cuándo una recurrencia no va a generar NADA, y cómo decirlo antes de guardar.
 *
 * EL BUG (producción, 2026-09-21). Se creó un evento el viernes 2 de octubre
 * con "cada 2 semanas, viernes" esperando el 2 y el 16. Solo salió el 2.
 *
 * Había DOS fechas mal, y las dos por lo mismo: el formulario tiene dos "fin"
 * distintos y nada dice cuál es cuál.
 *
 *  · FIN quedó en el 16 de octubre. Ese campo es cuándo termina ESTE evento, no
 *    la última repetición — así que el evento pasó a durar catorce días.
 *  · HASTA EL (el fin de la serie) quedó antes o el mismo día del inicio, así
 *    que la serie se acaba antes de producir una segunda fecha.
 *
 * El resultado es un evento que se ve una sola vez, exactamente igual que si no
 * tuviera recurrencia, y sin nada en pantalla que lo explique.
 *
 * Dos cosas hacen falta y son distintas:
 *  - IMPEDIRLO: un fin anterior al inicio no es una serie corta, es un error de
 *    dedo, y guardarlo no ayuda a nadie.
 *  - MOSTRARLO: con el fin EL MISMO DÍA del inicio la serie es válida —una sola
 *    fecha— pero casi nunca es lo que se quiso. Por eso la pantalla muestra las
 *    próximas fechas antes de guardar: ver "2 oct" solo, cuando se esperaban
 *    "2 oct, 16 oct, 30 oct", se nota de inmediato.
 *
 * Módulo PURO.
 */

export type ProblemaDeLaSerie =
  /** El fin es ANTERIOR al inicio: la serie no existe. */
  | { clase: 'fin_antes_del_inicio' }
  /** El fin es el mismo día del inicio: una sola fecha, probablemente sin querer. */
  | { clase: 'una_sola_fecha' }

export const MENSAJE_FIN_ANTES =
  'La repetición termina antes de la fecha del evento, así que no se crearía ninguna repetición. '
  + 'Corregí "hasta el" o quitá la repetición.'

export const MENSAJE_UNA_SOLA =
  'La repetición termina el mismo día en que empieza el evento: solo va a existir esa fecha.'

/**
 * @param inicio  'YYYY-MM-DD' del evento.
 * @param fin     'YYYY-MM-DD' del "hasta el". Vacío = sin fin, que es válido.
 */
export function problemaDeLaSerie(
  esRecurrente: boolean,
  inicio: string | null | undefined,
  fin: string | null | undefined,
): ProblemaDeLaSerie | null {
  if (!esRecurrente || !inicio || !fin) return null
  const i = inicio.slice(0, 10)
  const f = fin.slice(0, 10)
  if (f < i) return { clase: 'fin_antes_del_inicio' }
  if (f === i) return { clase: 'una_sola_fecha' }
  return null
}

/** ¿Hay que impedir el guardado? Solo el fin anterior al inicio. */
export function impideGuardar(p: ProblemaDeLaSerie | null): boolean {
  return p?.clase === 'fin_antes_del_inicio'
}

export function mensajeDelProblema(p: ProblemaDeLaSerie | null): string | null {
  if (!p) return null
  return p.clase === 'fin_antes_del_inicio' ? MENSAJE_FIN_ANTES : MENSAJE_UNA_SOLA
}

/**
 * Un evento que se repite y que además dura DÍAS es casi siempre la confusión
 * entre los dos "fin": se puso la fecha de la última repetición en el campo de
 * cuándo termina el evento.
 *
 * No se bloquea —hay retiros de fin de semana que se repiten— pero se dice, que
 * es lo que faltaba. El umbral es más de un día: un evento que cruza la
 * medianoche es normal; uno de catorce días repitiéndose cada dos semanas se
 * pisa a sí mismo.
 */
export function duracionSospechosa(
  esRecurrente: boolean,
  inicio: string | null | undefined,
  fin: string | null | undefined,
): number | null {
  if (!esRecurrente || !inicio || !fin) return null
  const i = new Date(inicio)
  const f = new Date(fin)
  if (isNaN(i.getTime()) || isNaN(f.getTime())) return null
  const dias = Math.floor((f.getTime() - i.getTime()) / 86_400_000)
  return dias > 1 ? dias : null
}

export function mensajeDeDuracion(dias: number): string {
  return `Este evento dura ${dias} días y además se repite. `
    + 'Ojo: "Fin" es cuándo termina ESTE evento, no la última repetición — '
    + 'la última repetición se pone en "hasta el", dentro de la repetición.'
}
