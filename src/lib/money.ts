// INT-3 · Totales de dinero POR MONEDA. Módulo puro (server + cliente).
//
// REGLA DE ORO: nunca se suman montos de monedas distintas y nunca se convierte
// automáticamente. Una conversión es una decisión contable con tipo de cambio y
// fecha; el sistema no la improvisa. Por eso el "total" de cualquier cosa acá no
// es un número, es un objeto {CRC: …, EUR: …} y se muestra una línea por moneda.
//
// Hoy en producción TODO está en colones (medido 2026-08-06: 14,714 donaciones,
// 6 pagos, 4 becas, 41 planes y 3,372 eventos, todos CRC), así que en la práctica
// se ve una sola línea. Esto existe para el día que entre el primer euro de
// Madrid: ese día el número de hoy pasaría a ser una suma sin significado.
import { CURRENCIES, formatMoney, type Currency } from '@/lib/format'

/** Total por moneda. Una moneda ausente significa "no hubo movimientos", que no
 *  es lo mismo que cero — por eso es Partial y no un Record completo. */
export type MoneyTotals = Partial<Record<Currency, number>>

const DEFAULT_CURRENCY: Currency = 'CRC'

/** Normaliza lo que venga de la BD (o de un CSV) a una moneda conocida.
 *  Sin moneda → CRC: todo lo histórico es en colones. */
export function toCurrency(value: string | null | undefined): Currency {
  const c = (value ?? '').toUpperCase()
  return (CURRENCIES as readonly string[]).includes(c) ? (c as Currency) : DEFAULT_CURRENCY
}

/** Suma agrupando por moneda. Acepta amount como number o string (numeric de
 *  Postgres llega como string por el driver). */
export function sumByCurrency(
  rows: Iterable<{ amount: number | string | null | undefined; currency?: string | null }>,
): MoneyTotals {
  const out: MoneyTotals = {}
  for (const r of rows) {
    const n = typeof r.amount === 'string' ? Number(r.amount) : (r.amount ?? 0)
    if (!Number.isFinite(n)) continue
    const c = toCurrency(r.currency)
    out[c] = (out[c] ?? 0) + n
  }
  return out
}

/** Junta dos totales sin mezclar monedas. Para armar un total a partir de
 *  varias fuentes (pagos + donaciones, por ejemplo). */
export function addTotals(...totales: MoneyTotals[]): MoneyTotals {
  const out: MoneyTotals = {}
  for (const t of totales) {
    for (const c of CURRENCIES) {
      if (t[c] === undefined) continue
      out[c] = (out[c] ?? 0) + (t[c] ?? 0)
    }
  }
  return out
}

/** Las monedas con movimiento, en orden fijo (CRC, USD, EUR) para que la UI no
 *  baile según el orden en que llegaron las filas. */
export function totalsEntries(t: MoneyTotals): Array<[Currency, number]> {
  return CURRENCIES.filter(c => t[c] !== undefined).map(c => [c, t[c] ?? 0])
}

/** ¿Hay una sola moneda? Con una, la UI muestra una línea suelta como siempre;
 *  con varias hay que mostrarlas apiladas y etiquetadas. */
export function isSingleCurrency(t: MoneyTotals): boolean {
  return totalsEntries(t).length <= 1
}

/** Una línea formateada por moneda. Sin movimientos → "₡0", que es lo que la
 *  gente espera ver en una tarjeta vacía (no un guion ni nada). */
export function formatTotals(t: MoneyTotals): string[] {
  const e = totalsEntries(t)
  if (e.length === 0) return [formatMoney(0, DEFAULT_CURRENCY)]
  return e.map(([c, n]) => formatMoney(n, c))
}

/** Todo junto en una línea, para textos y CSV: "₡1 250 000 · €340". */
export function formatTotalsInline(t: MoneyTotals): string {
  return formatTotals(t).join(' · ')
}

/** El total de UNA moneda (0 si no hubo movimientos). Para gráficos y otros
 *  lugares que necesitan un escalar: el que llama elige la moneda, el sistema
 *  no la adivina sumando todo. */
export function totalIn(t: MoneyTotals, currency: Currency): number {
  return t[currency] ?? 0
}

/** La moneda "principal" de un total: la única si hay una sola, si no CRC.
 *  Sirve para gráficos de una sola serie, que hay que etiquetar con ella. */
export function mainCurrency(t: MoneyTotals): Currency {
  const e = totalsEntries(t)
  return e.length === 1 ? e[0][0] : DEFAULT_CURRENCY
}

/** Lo que devuelven los RPC agrupados por moneda: {"CRC": 1250000, "EUR": 340}.
 *  Postgres serializa los numeric como string dentro del json. */
export function totalsFromJson(value: unknown): MoneyTotals {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const out: MoneyTotals = {}
  for (const c of CURRENCIES) {
    const v = raw[c]
    if (v === undefined || v === null) continue
    const n = Number(v)
    if (Number.isFinite(n)) out[c] = n
  }
  return out
}

// ── Compatibilidad entre monedas (becas, cupones, devoluciones) ──────────────

export const CURRENCY_MISMATCH_CODE = 'moneda_distinta'

const NOMBRE: Record<Currency, string> = { CRC: 'colones', USD: 'dólares', EUR: 'euros' }

/** Mensaje humano para el 409 cuando una beca/cupón no va con el cobro.
 *  Se dice en palabras, no en códigos: "colones" se entiende, "CRC" no. */
export function currencyMismatchMessage(
  descuento: string | null | undefined,
  cobro: string | null | undefined,
  que = 'Esta beca',
): string {
  return `${que} es en ${NOMBRE[toCurrency(descuento)]} y el cobro es en ${NOMBRE[toCurrency(cobro)]}.`
}

/** ¿Se puede aplicar un descuento de moneda A a un cobro de moneda B? */
export function currenciesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return toCurrency(a) === toCurrency(b)
}
