// Ventana para solicitar vacantes (líderes de comité): del día 25 al último día
// del mes, inclusive, en hora de Costa Rica (UTC-6, sin horario de verano).
//
// Robusto para cualquier mes: la condición es día-del-mes >= 25. Después del
// último día del mes viene el 01 (que es < 25 y queda fuera), así que cubre
// meses de 28/29/30/31 días sin calcular la cantidad de días.
//
// Módulo PURO (sin server) — importable desde cliente. El servidor lo usa con
// `new Date()` real; nunca confiamos en la hora del dispositivo para el rechazo.

export const VACANCY_REQUEST_OPEN_DAY = 25

/** Día del mes (1–31) en zona America/Costa_Rica para el instante dado. */
export function costaRicaDayOfMonth(now: Date = new Date()): number {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Costa_Rica',
    day: 'numeric',
  }).formatToParts(now).find(p => p.type === 'day')
  return Number(part?.value ?? '0')
}

/** ¿Está abierta la ventana de solicitud de vacantes ahora (hora CR)? */
export function isVacancyRequestWindowOpen(now: Date = new Date()): boolean {
  return costaRicaDayOfMonth(now) >= VACANCY_REQUEST_OPEN_DAY
}

export const VACANCY_REQUEST_WINDOW_TOOLTIP =
  'Las solicitudes de vacantes se reciben del 25 al último día de cada mes. Fuera de esa fecha, la solicitud está deshabilitada.'
