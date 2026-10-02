/**
 * PAG-6 · Las filas del export de conciliación.
 *
 * PARA QUÉ: Andrés registra en contabilidad una línea del estado de cuenta —
 * «el depósito del lunes y martes»— y necesita ver EXACTAMENTE los pagos que
 * la componen. La hoja es ese pegado: nombre, de qué era, cuánto y cuándo.
 *
 * Módulo PURO: arma las filas. Quien lee la base es la query y quien escribe
 * el .xlsx es la ruta. Está aparte para poder probar las dos reglas que
 * importan —el total por moneda y la fecha en día de Costa Rica— sin levantar
 * ni Excel ni la base.
 *
 * LAS DOS REGLAS:
 *
 * 1 · INT-3, los totales van POR MONEDA y jamás sumados entre sí. Un total
 *     que mezcle colones con dólares no es un número: es un error con
 *     apariencia de número, y en una conciliación contra el banco se propaga.
 *
 * 2 · La fecha se escribe en día de Costa Rica. `paid_at` es `timestamptz` y
 *     el runtime corre en UTC: un pago de las 6:57 p.m. del lunes se guarda
 *     como las 00:57 del martes. Escrito crudo, la hoja le pone al pago el
 *     día equivocado y la línea del banco no cuadra. Ver `rango-de-pagos.ts`,
 *     que resuelve lo mismo para el filtro.
 */

export type PagoParaConciliar = {
  member_name: string
  /** De qué era el cobro: el evento o el grupo de estudio. */
  entity_name: string
  /** La etiqueta derivada (matrícula, evento, folletos…). */
  concept: string | null
  amount: number | null
  currency: string | null
  paid_at: string | null
}

export type FilaDeConciliacion = {
  nombre: string
  actividad: string
  concepto: string
  monto: number | null
  moneda: string
  fecha_de_pago: string
}

const SIN_DATO = '—'

/** Costa Rica es UTC-6 todo el año; no hay horario de verano que ajustar. */
const ZONA_CR = 'America/Costa_Rica'

/** `YYYY-MM-DD` del instante, en día de Costa Rica. Vacío si no hay fecha. */
export function diaDePagoCR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // 'en-CA' da YYYY-MM-DD, que es el formato que ordena bien como texto.
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CR }).format(d)
}

/** La hora del pago en Costa Rica (HH:MM). Desempata dos pagos del mismo día. */
export function horaDePagoCR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CR', {
    timeZone: ZONA_CR, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
}

export function filasDeConciliacion(pagos: PagoParaConciliar[]): FilaDeConciliacion[] {
  return pagos.map(p => {
    const dia = diaDePagoCR(p.paid_at)
    const hora = horaDePagoCR(p.paid_at)
    return {
      nombre: p.member_name?.trim() || SIN_DATO,
      actividad: p.entity_name?.trim() || SIN_DATO,
      concepto: p.concept?.trim() || SIN_DATO,
      // El monto va como NÚMERO, no como texto con símbolo: en la hoja tiene
      // que poder sumarse. La moneda viaja en su propia columna.
      monto: typeof p.amount === 'number' ? p.amount : null,
      moneda: p.currency?.trim() || 'CRC',
      // Un pago sin fecha de pago (pendiente, cancelado) no inventa una.
      fecha_de_pago: dia ? (hora ? `${dia} ${hora}` : dia) : SIN_DATO,
    }
  })
}

/**
 * Los totales, uno por moneda. Nunca un total único.
 *
 * Los pagos históricos pueden tener la moneda en blanco: cuentan como CRC,
 * que es lo que son (la columna se agregó después, en INT-2). Un pago sin
 * monto no suma cero: no suma — cero afirmaría que no entró plata, y lo que
 * pasa es que no se sabe cuánta.
 */
export function totalesPorMoneda(filas: FilaDeConciliacion[]): Record<string, number> {
  const total: Record<string, number> = {}
  for (const f of filas) {
    if (typeof f.monto !== 'number') continue
    const m = f.moneda || 'CRC'
    total[m] = (total[m] ?? 0) + f.monto
  }
  return total
}

/** El resumen al pie de la hoja, en una línea legible. */
export function resumenDeConciliacion(filas: FilaDeConciliacion[]): string {
  const totales = totalesPorMoneda(filas)
  const partes = Object.entries(totales)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moneda, monto]) => `${moneda} ${monto.toLocaleString('es-CR')}`)
  const sinMonto = filas.filter(f => typeof f.monto !== 'number').length
  const cola = sinMonto > 0 ? ` · ${sinMonto} sin monto registrado` : ''
  return partes.length === 0
    ? `${filas.length} pagos${cola}`
    : `${filas.length} pagos · ${partes.join(' + ')}${cola}`
}
