// Helpers de formato compartidos (fechas e iniciales). Antes había ~19 copias
// de formatDate y ~18 de initials regadas por las páginas (auditoría 2026-06-11).

const LOCALE = 'es-CR'

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
