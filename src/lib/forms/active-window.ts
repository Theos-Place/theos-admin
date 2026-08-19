// Ventana de vigencia de un formulario (módulo puro, cliente + servidor).
//
// Un formulario puede tener fecha de inicio y fin de vigencia (opcionales).
// El estado NO se cambia con un cron: se deriva al leer, igual que los bloques
// de capacitación — así nunca se desincroniza.
//   · borrador:   is_active = false (apagado a mano).
//   · programado: activo pero la fecha de inicio no ha llegado.
//   · activo:     activo y dentro de la ventana (o sin fechas).
//   · vencido:    activo pero la fecha de fin ya pasó — deja de aceptar
//                 respuestas automáticamente.

export type FormWindowStatus = 'borrador' | 'programado' | 'activo' | 'vencido'

export function formWindowStatus(
  f: { is_active: boolean; starts_at?: string | null; ends_at?: string | null },
  now: Date = new Date(),
): FormWindowStatus {
  if (!f.is_active) return 'borrador'
  const t = now.getTime()
  if (f.starts_at && t < new Date(f.starts_at).getTime()) return 'programado'
  if (f.ends_at && t > new Date(f.ends_at).getTime()) return 'vencido'
  return 'activo'
}

export const FORM_WINDOW_LABEL: Record<FormWindowStatus, string> = {
  borrador: 'Inactivo',
  programado: 'Programado',
  activo: 'Activo',
  vencido: 'Vencido',
}

export const FORM_WINDOW_BADGE: Record<FormWindowStatus, string> = {
  borrador: 'bg-navy/10 text-navy-light/80',
  programado: 'bg-amber-50 text-amber-700',
  activo: 'bg-teal-soft/30 text-teal-deep',
  vencido: 'bg-coral/10 text-coral-deep',
}

/** Mensaje para quien intenta llenar un formulario fuera de su ventana. */
export const FORM_WINDOW_BLOCKED: Record<Exclude<FormWindowStatus, 'activo'>, string> = {
  borrador: 'Este formulario no está activo.',
  programado: 'Este formulario todavía no está abierto.',
  vencido: 'Este formulario ya cerró y no acepta más respuestas.',
}

// ── Fechas de la ventana (solo día, zona CR) ─────────────────────────────────
// El builder maneja YYYY-MM-DD; en la BD viven como timestamptz: el inicio
// arranca a las 00:00 y el fin cubre TODO el día (23:59:59), hora de Costa
// Rica (UTC-6 fijo, sin horario de verano).

export function windowStartToIso(dateYmd: string | null | undefined): string | null {
  return dateYmd ? `${dateYmd}T00:00:00-06:00` : null
}

export function windowEndToIso(dateYmd: string | null | undefined): string | null {
  return dateYmd ? `${dateYmd}T23:59:59-06:00` : null
}

/** ISO → YYYY-MM-DD en zona CR (para precargar los inputs del builder). */
export function isoToWindowYmd(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(d)
}
