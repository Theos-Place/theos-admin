// Helpers de formato compartidos (fechas e iniciales). Antes había ~19 copias
// de formatDate y ~18 de initials regadas por las páginas (auditoría 2026-06-11).

const LOCALE = 'es-CR'

const CR_TZ = 'America/Costa_Rica'

/** Fecha calendario (YYYY-MM-DD) de un Date en zona Costa Rica (UTC-6). El runtime
 *  (Vercel) corre en UTC, así que `new Date().toISOString().split('T')[0]` da el
 *  día equivocado entre las 18:00 y medianoche CR. `en-CA` formatea como YYYY-MM-DD. */
export function ymdCR(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: CR_TZ })
}

/** "Hoy" en zona Costa Rica como YYYY-MM-DD. Ver [[ymdCR]]. */
export function todayCR(): string {
  return ymdCR()
}

/** Fecha calendario (YYYY-MM-DD) de un Date en hora LOCAL del navegador. Para
 *  inputs/comparaciones de fecha en componentes cliente (en CR, local = CR).
 *  Para lógica server-side usá [[ymdCR]], que fuerza la zona CR. */
export function toYmdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Edad en años cumplidos a partir de la fecha de nacimiento. 0 si falta/ inválida. */
export function calcAge(birthDate: string | null | undefined): number {
  if (!birthDate) return 0
  const nac = new Date(birthDate)
  if (isNaN(nac.getTime())) return 0
  const hoy = new Date()
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

/** Fecha corta: "5 may 2026". null/inválida → '—'. */
export function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Fecha con mes completo: "5 de mayo de 2026" (es-CR usa "5 de mayo de 2026"). null → '—'. */
export function formatDateLong(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Fecha numérica: "05/05/2026". null → '—'. */
export function formatDateNumeric(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Fecha y hora: "5 may 2026, 02:30 p. m.". null → '—'. */
export function formatDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** Iniciales a partir de un nombre completo: "Ana María Soto" → "AM". */
export function getInitials(name: string | null | undefined): string {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** Iniciales a partir de nombre y apellido por separado. */
export function initialsFromParts(first: string | null | undefined, last: string | null | undefined): string {
  return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase()
}
