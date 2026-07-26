// PRE-3: regla de negocio del prematrimonial — la fecha de la boda no puede
// ser menor a 6 meses CALENDARIO desde hoy (no 180 días). Módulo puro,
// usable en cliente (min/default del input) y servidor (validación del POST).

export const PREMAT_MIN_MONTHS = 6

/** Suma meses calendario a una fecha YYYY-MM-DD. Si el día no existe en el mes
 *  destino (ej. 31 ago + 6 → feb), se ajusta al último día de ese mes. */
export function addCalendarMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const monthIndex = m - 1 + months
  const ty = y + Math.floor(monthIndex / 12)
  const tm = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(ty, tm + 1, 0).getDate()
  const td = Math.min(d, lastDay)
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(td).padStart(2, '0')}`
}

/** Fecha mínima (y default) de boda: hoy + 6 meses calendario. */
export function minCeremonyDate(todayYmd: string): string {
  return addCalendarMonths(todayYmd, PREMAT_MIN_MONTHS)
}

/** ¿La fecha de boda está antes del mínimo permitido? (YYYY-MM-DD compara
 *  lexicográficamente, no hace falta parsear.) */
export function ceremonyDateTooSoon(ceremonyYmd: string, todayYmd: string): boolean {
  return ceremonyYmd < minCeremonyDate(todayYmd)
}
