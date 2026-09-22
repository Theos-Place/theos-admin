/**
 * QA-1 · C1 — Leer el AÑO y el MES de una fecha sin que la zona horaria la corra.
 *
 * EL BUG QUE CIERRA (medido 2026-09-22). Los informes de finanzas agrupaban con
 * `new Date(d.donation_date).getMonth()`. `donation_date` es una columna `date`,
 * o sea el string 'YYYY-MM-DD', y `new Date` lo interpreta como medianoche UTC
 * — que en Costa Rica (UTC−6) son las 6 p.m. del día anterior:
 *
 *     new Date('2026-09-01').getMonth() + 1   → 8
 *     new Date('2026-01-01').getFullYear()    → 2025
 *
 * No era un caso de borde. Las 15.147 donaciones están registradas por trimestre
 * y TODAS caen el día 1 (1-ene, 1-abr, 1-jul, 1-oct), así que todas se contaban
 * un mes antes, y las 4.136 del 1.º de enero se contaban en el año anterior: se
 * caían del filtro de año de Transparencia.
 *
 * LA REGLA. De una fecha PURA no hace falta construir un `Date` para saber en
 * qué mes cae: el mes está escrito en el string. Construirlo es justamente lo
 * que mete la zona horaria en una pregunta que no la tiene. De un timestamp con
 * hora sí hay que decidir, y ahí se usa la hora local, que es la del usuario.
 *
 * Es puro para poder fijarlo con tests que corren en cualquier zona.
 */

const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

/** Año, mes (1-12) y día de una fecha. null si no se entiende. */
export function partesDeFecha(d: string | null | undefined): { anio: number; mes: number; dia: number } | null {
  if (!d) return null
  const m = SOLO_FECHA.exec(d)
  if (m) return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) }
  const fecha = new Date(d)
  if (isNaN(fecha.getTime())) return null
  return { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1, dia: fecha.getDate() }
}

/** El año calendario de una fecha. null si no se entiende. */
export function anioDe(d: string | null | undefined): number | null {
  return partesDeFecha(d)?.anio ?? null
}

/** El mes de una fecha, 1-12 (NO 0-11 como `getMonth`). null si no se entiende. */
export function mesDe(d: string | null | undefined): number | null {
  return partesDeFecha(d)?.mes ?? null
}

/** ¿La fecha cae en ese año y mes? `mes` va de 1 a 12. */
export function caeEn(d: string | null | undefined, anio: number, mes: number): boolean {
  const p = partesDeFecha(d)
  return p !== null && p.anio === anio && p.mes === mes
}

/**
 * Una fecha PURA como Date en hora local — el mismo día que dice el string.
 *
 * Es lo que hay que usar para comparar contra los límites de un filtro "desde /
 * hasta", donde los dos lados tienen que estar en la misma zona o la
 * comparación se corre medio día.
 */
export function fechaLocal(d: string): Date {
  const m = SOLO_FECHA.exec(d)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(d)
}
