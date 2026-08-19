/**
 * Criterio ÚNICO de asistencia activa del sistema (módulo PURO, sin server,
 * para poder importarlo desde componentes cliente sin arrastrar el cliente
 * admin). Usado por TODOS los consumidores: filtro de miembros, sede
 * calculada, dashboard, chip/ícono de perfil, elegibilidad de estudios,
 * invitaciones y matrícula.
 *
 * Activo = al menos ATTENDANCE_MIN_CHARLAS check-ins de charla en los
 * últimos ATTENDANCE_MONTHS meses, Y al menos uno de esos check-ins dentro
 * de los últimos ATTENDANCE_RECENCY_DAYS días. Ambas condiciones deben
 * cumplirse juntas.
 */
export const ATTENDANCE_MONTHS = 6
export const ATTENDANCE_MIN_CHARLAS = 6
export const ATTENDANCE_RECENCY_DAYS = 60

/** Criterio de asistencia REFORZADO, exclusivo de la elegibilidad de estudios
 *  de Etapa Intermedia: el doble de asistencias del criterio general (12 en
 *  vez de 6), con la MISMA ventana (6 meses) y la MISMA condición de
 *  recencia (≥1 en los últimos 60 días). El resto del sistema (asistencia
 *  general, otras etapas) sigue con ATTENDANCE_MIN_CHARLAS. */
export const ATTENDANCE_MIN_CHARLAS_INTERMEDIA = ATTENDANCE_MIN_CHARLAS * 2

/** Inicio (YYYY-MM-01) de la ventana: el día 1 del mes de hace `months` meses.
 *
 *  OJO con leer mal esto: lo que se excluye es el mes en curso del CONTEO de
 *  meses hacia atrás (si contara, la ventana se acortaría y los primeros días de
 *  cada mes dejarían a todo el mundo afuera). Los check-ins DEL MES EN CURSO SÍ
 *  cuentan: la ventana no tiene tope superior. Con `now` = 4 ago 2026 arranca el
 *  1 feb 2026, o sea 6 meses completos + lo que va de agosto. */
export function attendanceWindowStart(months = ATTENDANCE_MONTHS, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - months, 1) // inicio del mes más viejo
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** Inicio (ISO) de la ventana de recencia: `days` días atrás de `now`. */
export function attendanceRecencyStart(days = ATTENDANCE_RECENCY_DAYS, now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

/** Criterio único: ≥ `minCount` check-ins de charla dentro de los últimos
 *  `months` meses completos, Y al menos uno de esos check-ins dentro de los
 *  últimos `recencyDays` días. `dates` = fechas ISO de check-ins de charla. */
export function meetsAttendanceCriteria(
  dates: Iterable<string>,
  opts: { months?: number; minCount?: number; recencyDays?: number; now?: Date } = {},
): boolean {
  const { months = ATTENDANCE_MONTHS, minCount = ATTENDANCE_MIN_CHARLAS, recencyDays = ATTENDANCE_RECENCY_DAYS, now = new Date() } = opts
  const start = attendanceWindowStart(months, now)
  const recentStart = attendanceRecencyStart(recencyDays, now)
  let count = 0
  let hasRecent = false
  for (const d of dates) {
    if (!d || d < start) continue
    count++
    if (d >= recentStart) hasRecent = true
  }
  return count >= minCount && hasRecent
}

/** Texto del criterio, derivado de las constantes para no desfasarse. */
export const ATTENDANCE_GENERAL_TOOLTIP =
  `Se considera asistencia activa con al menos ${ATTENDANCE_MIN_CHARLAS} check-ins de charla en los últimos ${ATTENDANCE_MONTHS} meses, con al menos uno en los últimos ${ATTENDANCE_RECENCY_DAYS} días.`

/** Criterio reforzado para estudios (Etapa Intermedia). */
export const ATTENDANCE_ESTUDIOS_TOOLTIP =
  `Al menos ${ATTENDANCE_MIN_CHARLAS_INTERMEDIA} charlas con check-in en los últimos ${ATTENDANCE_MONTHS} meses, con al menos una en los últimos ${ATTENDANCE_RECENCY_DAYS} días.`

/** Criterio "sigue asistiendo hoy" (más laxo que el comprometido): al menos
 *  ACTIVE_ATTENDANCE_MIN check-ins de charla en los últimos ACTIVE_ATTENDANCE_MONTHS
 *  meses. Se usa en el reporte de retención para distinguir a quien sigue viniendo
 *  de quien se perdió. Sin condición de recencia adicional. */
export const ACTIVE_ATTENDANCE_MONTHS = 4
export const ACTIVE_ATTENDANCE_MIN = 2

/** Texto del criterio "sigue asistiendo", derivado de las constantes. */
export const ACTIVE_ATTENDANCE_TOOLTIP =
  `Sigue asistiendo: al menos ${ACTIVE_ATTENDANCE_MIN} check-ins de charla en los últimos ${ACTIVE_ATTENDANCE_MONTHS} meses.`
