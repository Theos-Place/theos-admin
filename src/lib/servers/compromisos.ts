/**
 * SRV-4 · Los compromisos de cada persona del comité.
 *
 * Módulo PURO: el caller resuelve los datos y esto decide. Ninguna de las
 * cuatro reglas se define acá — todas vienen de donde ya viven:
 *
 *  - asistencia: `getActiveAttendanceMemberIds()` (@/lib/attendance, el mismo
 *    criterio que usa la elegibilidad de estudios);
 *  - donante activo: `members.is_donor`, el flag que mantiene
 *    `refresh_donor_flags()` con el criterio por trimestres de FIN-1;
 *  - estudios y último check-in: consultas agregadas en `mi-comite.ts`.
 *
 * Reimplementar cualquiera de las cuatro habría creado una segunda definición
 * que se desincroniza en silencio — el error que SRV-5 acaba de limpiar con el
 * encargado del comité.
 */

export type Compromisos = {
  /** Cumple el criterio de asistencia activa a charlas. */
  asistencia: boolean
  /** Matriculada en un estudio en los últimos 12 meses. */
  llevandoEstudio: boolean
  /** Dirigente o co-dirigente de un grupo en los últimos 12 meses. */
  dandoEstudio: boolean
  /** Donante activo (criterio por trimestres). */
  donante: boolean
  /** Fecha del último check-in a un evento, o null si nunca. */
  ultimoCheckin: string | null
}

/**
 * ¿Le falta algo? Es lo que filtra el "solo los que no cumplen algo".
 *
 * Estudio cuenta como cumplido con CUALQUIERA de los dos: quien está dando un
 * grupo está en un estudio tanto como quien lo lleva, y pedirle las dos cosas
 * marcaría en rojo a media planilla de dirigentes.
 *
 * El último check-in NO entra: es un dato para mirar, no un requisito — no hay
 * una fecha a partir de la cual "no cumple", y la asistencia ya se mide con su
 * propia regla.
 */
export function leFaltaAlgo(c: Compromisos): boolean {
  return !c.asistencia || !(c.llevandoEstudio || c.dandoEstudio) || !c.donante
}

/** Lo que le falta, en palabras, para el tooltip y el export. */
export function faltantes(c: Compromisos): string[] {
  const f: string[] = []
  if (!c.asistencia) f.push('asistencia')
  if (!c.llevandoEstudio && !c.dandoEstudio) f.push('estudio')
  if (!c.donante) f.push('donación')
  return f
}

/** Badge de estudio: puede llevar y dar a la vez. '' si ninguno. */
export function etiquetaDeEstudio(c: Compromisos): string {
  const partes: string[] = []
  if (c.llevandoEstudio) partes.push('Llevando')
  if (c.dandoEstudio) partes.push('Dando')
  return partes.join(' · ')
}
