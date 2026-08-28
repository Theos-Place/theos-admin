// Construcción, lectura y descripción de la regla de repetición de un evento.
// Módulo puro: la pantalla arma la UI, esto decide qué string se guarda.
//
// El expansor (expand-recurrence.ts) usa la librería rrule y ya entendía RRULE
// estándar, así que "cada 2 semanas" y "primer y tercer sábado" funcionaban en
// el motor desde antes — lo que faltaba era poder decirlo.

export type Freq = 'WEEKLY' | 'MONTHLY'
export type MonthMode = 'dom' | 'dow'

export type Recurrencia = {
  freq: Freq
  /** Cada cuántas semanas/meses. 1 = todas. */
  interval: number
  /** Días de la semana en formato propio (MON…SUN), para la frecuencia semanal. */
  days: string[]
  monthMode: MonthMode
  /** Día del mes (modo 'dom'). */
  monthDay: number
  /** Posiciones dentro del mes (modo 'dow'): 1..4 y -1 = último. VARIAS, que es
   *  lo que permite "primer y tercer sábado". */
  monthPos: string[]
  /** Día de la semana del modo 'dow', en código RRULE de 2 letras. */
  monthDow: string
}

const ORDEN = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const A_RRULE: Record<string, string> = { MON: 'MO', TUE: 'TU', WED: 'WE', THU: 'TH', FRI: 'FR', SAT: 'SA', SUN: 'SU' }
const DE_RRULE: Record<string, string> = Object.fromEntries(Object.entries(A_RRULE).map(([k, v]) => [v, k]))
const NOMBRE_DIA: Record<string, string> = {
  MO: 'lunes', TU: 'martes', WE: 'miércoles', TH: 'jueves', FR: 'viernes', SA: 'sábado', SU: 'domingo',
}
const NOMBRE_POS: Record<string, string> = { '1': 'primer', '2': 'segundo', '3': 'tercer', '4': 'cuarto', '-1': 'último' }
const ORDEN_POS = ['1', '2', '3', '4', '-1']

export const RECURRENCIA_DEFAULT: Recurrencia = {
  freq: 'WEEKLY', interval: 1, days: ['SUN'],
  monthMode: 'dom', monthDay: 1, monthPos: ['1'], monthDow: 'MO',
}

/**
 * Recurrencia → el string que se guarda.
 *
 * El formato propio "WEEKLY:MON,WED" se conserva para el caso simple, que es la
 * inmensa mayoría de los eventos y lo que ya está escrito en la base. En cuanto
 * hay intervalo se emite RRULE estándar, que es lo que sabe expresarlo.
 */
export function construirRegla(r: Recurrencia): string {
  const interval = Math.max(1, Math.floor(r.interval || 1))
  if (r.freq === 'WEEKLY') {
    const dias = ORDEN.filter(d => r.days.includes(d))
    const usar = dias.length ? dias : ['SUN']
    if (interval === 1) return `WEEKLY:${usar.join(',')}`
    return `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${usar.map(d => A_RRULE[d]).join(',')}`
  }
  const cada = interval === 1 ? '' : `;INTERVAL=${interval}`
  if (r.monthMode === 'dom') return `FREQ=MONTHLY${cada};BYMONTHDAY=${r.monthDay}`
  const pos = ORDEN_POS.filter(p => r.monthPos.includes(p))
  const usar = pos.length ? pos : ['1']
  return `FREQ=MONTHLY${cada};BYDAY=${usar.map(p => `${p}${r.monthDow}`).join(',')}`
}

/** El string guardado → recurrencia, o null si no se reconoce. */
export function leerRegla(regla: string | null | undefined): Recurrencia | null {
  const r = (regla ?? '').trim()
  if (!r) return null

  const propio = r.match(/^WEEKLY:([A-Z,]+)$/i)
  if (propio) {
    const days = propio[1].toUpperCase().split(',').map(s => s.trim()).filter(d => ORDEN.includes(d))
    if (!days.length) return null
    return { ...RECURRENCIA_DEFAULT, freq: 'WEEKLY', days }
  }

  const sinPrefijo = r.replace(/^RRULE:/i, '')
  const interval = Number(sinPrefijo.match(/INTERVAL=(\d+)/i)?.[1] ?? '1') || 1

  if (/FREQ=WEEKLY/i.test(sinPrefijo)) {
    const byday = sinPrefijo.match(/BYDAY=([A-Z,]+)/i)?.[1] ?? ''
    const days = byday.toUpperCase().split(',').map(s => DE_RRULE[s.trim()]).filter(Boolean)
    return { ...RECURRENCIA_DEFAULT, freq: 'WEEKLY', interval, days: days.length ? days : ['SUN'] }
  }

  if (/FREQ=MONTHLY/i.test(sinPrefijo)) {
    const bmd = sinPrefijo.match(/BYMONTHDAY=(\d+)/i)
    if (bmd) {
      return { ...RECURRENCIA_DEFAULT, freq: 'MONTHLY', interval, monthMode: 'dom', monthDay: Number(bmd[1]) }
    }
    const byday = sinPrefijo.match(/BYDAY=([-\dA-Z,]+)/i)?.[1] ?? ''
    const partes = byday.toUpperCase().split(',').map(s => s.trim().match(/^(-?\d)([A-Z]{2})$/)).filter(Boolean)
    if (partes.length) {
      return {
        ...RECURRENCIA_DEFAULT, freq: 'MONTHLY', interval, monthMode: 'dow',
        monthPos: partes.map(p => p![1]), monthDow: partes[0]![2],
      }
    }
    return { ...RECURRENCIA_DEFAULT, freq: 'MONTHLY', interval, monthMode: 'dom' }
  }
  return null
}

/** "Cada 2 semanas los sábados" · "El primer y tercer sábado de cada mes". */
export function describirRegla(r: Recurrencia): string {
  const interval = Math.max(1, Math.floor(r.interval || 1))
  if (r.freq === 'WEEKLY') {
    const dias = ORDEN.filter(d => r.days.includes(d)).map(d => NOMBRE_DIA[A_RRULE[d]])
    const lista = unir(dias)
    return interval === 1 ? `Todas las semanas los ${lista}` : `Cada ${interval} semanas los ${lista}`
  }
  const cada = interval === 1 ? 'de cada mes' : `cada ${interval} meses`
  if (r.monthMode === 'dom') return `El día ${r.monthDay} ${cada}`
  const pos = ORDEN_POS.filter(p => r.monthPos.includes(p)).map(p => NOMBRE_POS[p])
  return `El ${unir(pos.length ? pos : ['primer'])} ${NOMBRE_DIA[r.monthDow]} ${cada}`
}

/** ['a','b','c'] → 'a, b y c'. */
function unir(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}
