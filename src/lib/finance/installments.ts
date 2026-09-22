// FIN-4 · Reparto de un monto en tractos y vencimientos.
//
// Módulo puro: la suma de los tractos tiene que dar EXACTAMENTE el total, en
// cualquier moneda. Un reparto ingenuo (total/n redondeado) pierde o inventa
// plata: ₡10 000 en 3 daría 3333×3 = ₡9 999. Acá el sobrante se distribuye en
// los primeros tractos, así que la suma cierra siempre.

import { currencyDecimals, formatMoney, formatDate } from '@/lib/format'

/** Tope de tractos de un arreglo. Más que esto no es un arreglo de pago, es
 *  otra cosa (y la cola de revisión se vuelve inmanejable). */
export const MAX_INSTALLMENTS = 24
export const MIN_INSTALLMENTS = 2

/**
 * Parte `total` en `count` tractos cuya suma es exactamente `total`.
 * El sobrante de la unidad mínima de la moneda va a los PRIMEROS tractos
 * (paga más al principio: si el arreglo se cae a mitad, lo cobrado es mayor).
 *
 * Devuelve [] si los parámetros no son válidos.
 */
export function splitAmount(total: number, count: number, currency: string | null = 'CRC'): number[] {
  if (!Number.isFinite(total) || total <= 0) return []
  if (!Number.isInteger(count) || count < 1) return []

  const f = 10 ** currencyDecimals(currency)
  // Se trabaja en la unidad mínima (colones enteros, céntimos) para no arrastrar
  // errores de punto flotante.
  const totalUnits = Math.round(total * f)
  if (totalUnits < count) return []

  const base = Math.floor(totalUnits / count)
  const remainder = totalUnits - base * count

  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / f)
}

/**
 * Vencimientos mensuales a partir de `firstDue` (YYYY-MM-DD), uno por tracto.
 *
 * Si el día no existe en el mes destino (31 de enero → febrero), cae al último
 * día de ese mes en vez de saltar al mes siguiente, que es lo que hace el
 * `setMonth` de JS y correría todo el calendario.
 */
export function monthlyDueDates(firstDue: string, count: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDue)) return []
  if (!Number.isInteger(count) || count < 1) return []

  const [y, m, d] = firstDue.split('-').map(Number)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const targetMonth = m - 1 + i
    const year = y + Math.floor(targetMonth / 12)
    const month = ((targetMonth % 12) + 12) % 12
    // Día 0 del mes siguiente = último día de este mes.
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const day = Math.min(d, lastDay)
    out.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  return out
}

/**
 * Vencimientos QUINCENALES: los días 15 y 30 de cada mes.
 *
 * Así lo definió finanzas (2026-09-22), y es lo que espera la gente porque es
 * como se paga el salario en Costa Rica. La primera versión de esto hacía "cada
 * 15 días corridos" y estaba mal: el 5 y el 20 de un mes no son una quincena
 * para nadie acá.
 *
 * Por eso la función NO se llama `biweekly`: quincenal y bisemanal son cosas
 * distintas, y el nombre en inglés invitaba justo al error que se cometió.
 *
 * CÓMO SE ARMAN. El PRIMER vencimiento es el que eligió finanzas, tal cual —
 * suele ser hoy, porque el arreglo se pacta con el primer pago en la mano. De
 * ahí en adelante cada fecha salta al siguiente corte: si la anterior cayó
 * antes del 15, va al 15 del mismo mes; si cayó entre el 15 y el corte de fin
 * de mes, va a ese corte; y si cayó en el corte de fin de mes, va al 15 del
 * siguiente.
 *
 * FEBRERO NO TIENE 30, así que el corte de fin de mes es el ÚLTIMO DÍA del mes:
 * 28, o 29 en bisiesto. Vale para los meses de 31 también — el corte es el 30,
 * no el 31, porque la quincena es el 30.
 */
function corteDeFinDeMes(year: number, month0: number): number {
  const ultimo = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
  return Math.min(30, ultimo)
}

export function quincenalDueDates(firstDue: string, count: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDue)) return []
  if (!Number.isInteger(count) || count < 1) return []

  const [y, m, d] = firstDue.split('-').map(Number)
  const ymd = (year: number, month0: number, day: number) =>
    `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const out = [firstDue]
  let year = y, month0 = m - 1, day = d
  while (out.length < count) {
    const corte = corteDeFinDeMes(year, month0)
    if (day < 15) {
      day = 15
    } else if (day < corte) {
      day = corte
    } else {
      // Ya estaba en el corte de fin de mes (o pasado, si eligieron el 31):
      // toca el 15 del mes siguiente.
      month0 += 1
      if (month0 > 11) { month0 = 0; year += 1 }
      day = 15
    }
    out.push(ymd(year, month0, day))
  }
  return out
}

/** Cada cuánto vencen los tractos. */
export type PlanFrequency = 'mensual' | 'quincenal'
export const FREQUENCIES: PlanFrequency[] = ['mensual', 'quincenal']
export const FREQUENCY_LABEL: Record<PlanFrequency, string> = {
  mensual: 'Mensual',
  quincenal: 'Quincenal (15 y 30 de cada mes)',
}

/** Los vencimientos según la frecuencia. */
export function dueDates(firstDue: string, count: number, frequency: PlanFrequency = 'mensual'): string[] {
  return frequency === 'quincenal'
    ? quincenalDueDates(firstDue, count)
    : monthlyDueDates(firstDue, count)
}

export type PlannedInstallment = { number: number; amount: number; due_date: string }

/** Los tractos listos para insertar: número, monto y vencimiento. */
export function planInstallments(input: {
  total: number
  count: number
  firstDue: string
  currency?: string | null
  /** FIN-8. Default 'mensual' para no romper a quien ya llamaba sin esto. */
  frequency?: PlanFrequency
}): PlannedInstallment[] {
  const amounts = splitAmount(input.total, input.count, input.currency ?? 'CRC')
  const dates = dueDates(input.firstDue, input.count, input.frequency ?? 'mensual')
  if (amounts.length !== input.count || dates.length !== input.count) return []
  return amounts.map((amount, i) => ({ number: i + 1, amount, due_date: dates[i] }))
}

/**
 * ¿Este tracto está VENCIDO e impago? Es la condición que bloquea matricularse
 * o inscribirse a otro evento (FIN-4 punto 3). Un tracto futuro al día NO
 * bloquea.
 *
 * `todayYmd` se inyecta (hora de Costa Rica la resuelve el llamador) para que
 * la regla sea testeable y no dependa del reloj del proceso.
 */
export function isOverdue(
  installment: { due_date: string | null; status: string },
  todayYmd: string,
): boolean {
  if (!installment.due_date) return false
  if (installment.status !== 'pending') return false
  return installment.due_date < todayYmd
}

/**
 * Mensaje del bloqueo, con el detalle de lo que se debe (FIN-4 pide "mensaje
 * claro con el detalle"): cuántos tractos, cuánto suman y desde cuándo.
 *
 * Los montos se suman por moneda: mezclar ₡ con € en un total sería mentira.
 */
export function overdueBlockMessage(
  items: Array<{ amount: number; currency: string; due_date: string }>,
  who: 'self' | 'other' = 'self',
): string {
  if (items.length === 0) return ''
  const porMoneda = new Map<string, number>()
  for (const i of items) porMoneda.set(i.currency, (porMoneda.get(i.currency) ?? 0) + i.amount)
  const totales = [...porMoneda.entries()].map(([cur, amount]) => formatMoney(amount, cur)).join(' + ')
  const masViejo = items.reduce((a, b) => (a.due_date <= b.due_date ? a : b)).due_date
  const n = items.length
  const sujeto = who === 'self' ? 'Tenés' : 'Esta persona tiene'
  const accion = who === 'self' ? 'Completá' : 'Hay que completar'
  return `${sujeto} ${n} tracto${n > 1 ? 's' : ''} vencido${n > 1 ? 's' : ''} por ${totales} `
    + `(el más antiguo venció el ${formatDate(masViejo)}). ${accion} el arreglo de pago antes de continuar.`
}

/**
 * Resumen para el aviso INTERNO a finanzas: cuánta gente y cuántos tractos hay
 * vencidos, y por cuánto. Igual que en el mensaje del bloqueo, los montos van
 * por moneda — un total mezclando ₡ y € sería mentira.
 */
export function financeOverdueSummary(
  items: Array<{ member_id: string; amount: number; currency: string }>,
): { members: number; installments: number; totals: string } {
  const porMoneda = new Map<string, number>()
  const miembros = new Set<string>()
  for (const i of items) {
    porMoneda.set(i.currency, (porMoneda.get(i.currency) ?? 0) + i.amount)
    miembros.add(i.member_id)
  }
  return {
    members: miembros.size,
    installments: items.length,
    totals: [...porMoneda.entries()].map(([cur, amount]) => formatMoney(amount, cur)).join(' + '),
  }
}
