/**
 * Ventanas del criterio de asistencia activa (módulo PURO, sin server, para
 * poder importarlo desde componentes cliente sin arrastrar el cliente admin).
 *  - GENERAL (12 meses): filtro de miembros, sede calculada, dashboard, chip de la lista.
 *  - STUDIES (6 meses): elegibilidad/invitaciones/matrícula/análisis de estudios.
 */
export const ATTENDANCE_MONTHS_GENERAL = 12
export const ATTENDANCE_MONTHS_STUDIES = 6

/** Texto del criterio general (12 meses), derivado de la constante para no desfasarse. */
export const ATTENDANCE_GENERAL_TOOLTIP =
  `Se considera asistencia activa al menos 1 check-in de charla por mes en los últimos ${ATTENDANCE_MONTHS_GENERAL} meses.`
