/**
 * DON-2 · Qué es una donación válida cargada a mano.
 *
 * Existe aparte del import porque las dos entradas tienen reglas distintas: el
 * import trae monto siempre (sale del reporte del banco) y acá el monto puede
 * faltar — se sabe que alguien dio pero el reporte todavía no llegó.
 *
 * LA REGLA DEL MONTO. Vacío es NULL, nunca 0. Cero es un monto real: sumaría
 * como tal en los reportes y la donación aparecería como "₡0" en vez de "sin
 * monto". Son cosas distintas y la base ahora las distingue.
 */
import { CURRENCIES, type Currency } from '@/lib/format'

export type EntradaDeDonacion = {
  member_id: string
  donation_date: string
  /** Vacío, null o ausente = sin monto conocido. */
  amount?: number | string | null
  currency?: string | null
  note?: string | null
}

export type DonacionNormalizada = {
  member_id: string
  donation_date: string
  amount: number | null
  currency: Currency
  note: string | null
}

export type MotivoInvalido =
  | 'sin_persona' | 'fecha_invalida' | 'fecha_futura'
  | 'monto_negativo' | 'monto_no_numerico' | 'moneda_desconocida'

export const MENSAJES: Record<MotivoInvalido, string> = {
  sin_persona: 'Elegí a quién le corresponde la donación.',
  fecha_invalida: 'La fecha de la donación no es válida.',
  fecha_futura: 'La donación no puede ser de una fecha futura.',
  monto_negativo: 'El monto no puede ser negativo. Dejalo vacío si todavía no se sabe.',
  monto_no_numerico: 'El monto tiene que ser un número. Dejalo vacío si todavía no se sabe.',
  moneda_desconocida: 'Esa moneda no está soportada.',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * @param hoyYmd fecha civil de hoy en Costa Rica. Se inyecta para poder
 *   testear, y porque "futura" se juzga en la zona de acá y no en UTC: a las
 *   7 p.m. del martes, UTC ya está en miércoles.
 */
export function normalizarDonacion(
  entrada: EntradaDeDonacion, hoyYmd: string,
): { ok: true; datos: DonacionNormalizada } | { ok: false; motivo: MotivoInvalido } {
  if (!entrada.member_id || !UUID.test(entrada.member_id)) return { ok: false, motivo: 'sin_persona' }
  const fecha = String(entrada.donation_date ?? '').trim()
  if (!FECHA.test(fecha) || Number.isNaN(Date.parse(`${fecha}T12:00:00Z`))) {
    return { ok: false, motivo: 'fecha_invalida' }
  }
  // Una donación futura es siempre un error de tecleo; el pasado no se acota
  // porque se cargan reportes viejos.
  if (fecha > hoyYmd) return { ok: false, motivo: 'fecha_futura' }

  const crudo = entrada.amount
  let amount: number | null = null
  if (crudo !== null && crudo !== undefined && String(crudo).trim() !== '') {
    const n = Number(crudo)
    if (!Number.isFinite(n)) return { ok: false, motivo: 'monto_no_numerico' }
    if (n < 0) return { ok: false, motivo: 'monto_negativo' }
    amount = n
  }

  const moneda = (entrada.currency ?? 'CRC').trim().toUpperCase()
  if (!(CURRENCIES as readonly string[]).includes(moneda)) return { ok: false, motivo: 'moneda_desconocida' }

  const nota = String(entrada.note ?? '').trim()
  return {
    ok: true,
    datos: { member_id: entrada.member_id, donation_date: fecha, amount, currency: moneda as Currency, note: nota || null },
  }
}
