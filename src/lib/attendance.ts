/**
 * Ventanas del criterio de asistencia activa (módulo PURO, sin server, para
 * poder importarlo desde componentes cliente sin arrastrar el cliente admin).
 *  - GENERAL (6 meses, CONTEO): filtro de miembros, sede calculada, dashboard,
 *    chip de la lista, ícono del header. Activo = al menos ATTENDANCE_MIN_CHARLAS_GENERAL
 *    check-ins de charla en los últimos 6 meses completos (≈1 por mes).
 *  - STUDIES (6 meses, COBERTURA): elegibilidad/invitaciones/análisis de estudios.
 *    Activo = ≥1 check-in de charla en CADA uno de los últimos 6 meses.
 */
export const ATTENDANCE_MONTHS_GENERAL = 6
export const ATTENDANCE_MONTHS_STUDIES = 6

/** Mínimo de check-ins de charla para el criterio general (conteo, no cobertura). */
export const ATTENDANCE_MIN_CHARLAS_GENERAL = 6

/** Inicio (YYYY-MM-01) del mes completo más viejo de la ventana: últimos `months`
 *  meses calendario COMPLETOS, excluyendo el mes en curso (incluirlo dejaría a
 *  todo el mundo afuera los primeros días de cada mes). */
export function attendanceWindowStart(months = ATTENDANCE_MONTHS_GENERAL, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - months, 1) // inicio del mes más viejo
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** Criterio general por CONTEO: ≥ `minCount` check-ins de charla dentro de la
 *  ventana de `months` meses completos. `dates` = fechas ISO de check-ins de charla. */
export function attendanceCountSatisfiesCriteria(
  dates: Iterable<string>,
  months = ATTENDANCE_MONTHS_GENERAL,
  minCount = ATTENDANCE_MIN_CHARLAS_GENERAL,
  now = new Date(),
): boolean {
  const start = attendanceWindowStart(months, now)
  let n = 0
  for (const d of dates) {
    if (d && d >= start) { n++; if (n >= minCount) return true }
  }
  return false
}

/** Texto del criterio general, derivado de las constantes para no desfasarse. */
export const ATTENDANCE_GENERAL_TOOLTIP =
  `Se considera asistencia activa con al menos ${ATTENDANCE_MIN_CHARLAS_GENERAL} check-ins de charla en los últimos ${ATTENDANCE_MONTHS_GENERAL} meses (alrededor de una vez al mes).`
