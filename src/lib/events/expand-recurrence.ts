/**
 * Expansión VIRTUAL de eventos recurrentes: no se materializan filas en la BD.
 * Cada ocurrencia es una copia del evento con starts/ends desplazados, un flag
 * is_occurrence y una occurrence_key única para React (el id se conserva para
 * que el clic lleve al detalle del evento padre).
 *
 * Reglas soportadas:
 *  - Formato propio de la BD: "WEEKLY:TUE" o "WEEKLY:TUE,THU"
 *  - RRULE estándar: "FREQ=WEEKLY;BYDAY=TU" (con o sin prefijo RRULE:)
 * Reglas inválidas no rompen: se loguea y se muestra solo la instancia original.
 */
import { RRule, Weekday } from 'rrule'

type RecurringLike = {
  id: string
  start_at: string
  end_at: string
  is_recurring: boolean
  recurrence_rule: string | null
  recurrence_end?: string | null
  /** Fechas YYYY-MM-DD (hora CR) a excluir de la serie (EXDATE/override). */
  exception_dates?: string[]
}

/** Fecha local (hora CR del navegador) → 'YYYY-MM-DD'. */
function localYmd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export type Occurrence<T extends RecurringLike> = T & {
  is_occurrence: true
  occurrence_key: string
}

const DAY_MAP: Record<string, Weekday> = {
  MON: RRule.MO, TUE: RRule.TU, WED: RRule.WE, THU: RRule.TH,
  FRI: RRule.FR, SAT: RRule.SA, SUN: RRule.SU,
  // abreviaturas RRULE estándar
  MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH,
  FR: RRule.FR, SA: RRule.SA, SU: RRule.SU,
}

const DAY_LABEL: Record<string, string> = {
  MON: 'lunes', TUE: 'martes', WED: 'miércoles', THU: 'jueves',
  FRI: 'viernes', SAT: 'sábado', SUN: 'domingo',
  MO: 'lunes', TU: 'martes', WE: 'miércoles', TH: 'jueves',
  FR: 'viernes', SA: 'sábado', SU: 'domingo',
}

/* rrule calcula los días de semana sobre el día UTC, pero las charlas son por
 * la noche hora CR (UTC-6): un martes 19:00 CR es miércoles 01:00 UTC y la
 * regla "WEEKLY:TUE" generaría lunes locales. Truco estándar: construir una
 * fecha "falsa UTC" con los componentes LOCALES, iterar ahí y deshacer. */
function toFakeUTC(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()))
}
function fromFakeUTC(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())
}

function parseRule(rule: string, dtstart: Date, until: Date): RRule | null {
  const r = rule.trim()
  // Formato propio: WEEKLY:TUE / WEEKLY:TUE,THU
  const custom = r.match(/^WEEKLY:([A-Z,]+)$/i)
  if (custom) {
    const days = custom[1].toUpperCase().split(',').map(d => DAY_MAP[d.trim()]).filter(Boolean)
    if (!days.length) return null
    return new RRule({ freq: RRule.WEEKLY, byweekday: days, dtstart, until })
  }
  // RRULE estándar
  try {
    const parsed = RRule.fromString(r.replace(/^RRULE:/i, ''))
    return new RRule({ ...parsed.origOptions, dtstart, until: parsed.origOptions.until ?? until })
  } catch {
    return null
  }
}

/** Ocurrencias virtuales de un evento recurrente dentro del rango [from, to). */
export function expandRecurring<T extends RecurringLike>(event: T, from: Date, to: Date): Array<Occurrence<T>> {
  if (!event.is_recurring || !event.recurrence_rule) return []
  const realStart = new Date(event.start_at)
  const dtstart = toFakeUTC(realStart)
  const durationMs = Math.max(0, new Date(event.end_at).getTime() - realStart.getTime())
  const until = event.recurrence_end ? new Date(event.recurrence_end) : to

  const rule = parseRule(event.recurrence_rule, dtstart, toFakeUTC(until < to ? until : to))
  if (!rule) {
    console.warn(`expandRecurring: regla inválida "${event.recurrence_rule}" en evento ${event.id} — se muestra solo la original`)
    return []
  }

  const excepted = new Set(event.exception_dates ?? [])
  try {
    return rule
      .between(toFakeUTC(from), toFakeUTC(to), true)
      .map(fromFakeUTC)
      // la instancia original ya está en la lista: no duplicarla
      .filter(d => d.getTime() !== realStart.getTime())
      // EXDATE: ocurrencias canceladas o reemplazadas por un override
      .filter(d => !excepted.has(localYmd(d)))
      .map(d => ({
        ...event,
        start_at: d.toISOString(),
        end_at: new Date(d.getTime() + durationMs).toISOString(),
        is_occurrence: true as const,
        occurrence_key: `${event.id}@${d.toISOString()}`,
      }))
  } catch (e) {
    console.warn(`expandRecurring: error expandiendo ${event.id}:`, e)
    return []
  }
}

/** Próxima ocurrencia (>= after) de un recurrente; null si no hay o la regla es inválida.
 *  Salta las fechas exceptuadas (canceladas/override). */
export function nextOccurrence(event: RecurringLike, after: Date): Date | null {
  if (!event.is_recurring || !event.recurrence_rule) return null
  const excepted = new Set(event.exception_dates ?? [])
  const realStart = new Date(event.start_at)
  if (realStart >= after && !excepted.has(localYmd(realStart))) return realStart
  const until = event.recurrence_end
    ? new Date(event.recurrence_end)
    : new Date(after.getTime() + 366 * 86400000)
  const rule = parseRule(event.recurrence_rule, toFakeUTC(realStart), toFakeUTC(until))
  if (!rule) return null
  try {
    // Itera buscando la primera ocurrencia no exceptuada (límite defensivo).
    let cursor = after
    for (let i = 0; i < 200; i++) {
      const next = rule.after(toFakeUTC(cursor), true)
      if (!next) return null
      const local = fromFakeUTC(next)
      if (!excepted.has(localYmd(local))) return local
      cursor = new Date(local.getTime() + 1000) // avanza 1s para no repetir
    }
    return null
  } catch {
    return null
  }
}

const POS_LABEL: Record<string, string> = {
  '1': 'primer', '2': 'segundo', '3': 'tercer', '4': 'cuarto', '-1': 'último',
}

/** Etiqueta humana de la regla: "Cada martes", "El día 15 de cada mes",
 *  "El segundo martes de cada mes". */
export function recurrenceLabel(rule: string | null): string | null {
  if (!rule) return null
  const r = rule.trim()
  const isMonthly = /FREQ=MONTHLY/i.test(r) || /^MONTHLY:/i.test(r)

  if (isMonthly) {
    const byMonthDay = r.match(/BYMONTHDAY=(-?\d+)/i)
    if (byMonthDay) return `El día ${byMonthDay[1]} de cada mes`
    const byDayPos = r.match(/BYDAY=(-?\d)([A-Z]{2})/i)
    if (byDayPos) {
      const pos = POS_LABEL[byDayPos[1]] ?? `${byDayPos[1]}º`
      const day = DAY_LABEL[byDayPos[2].toUpperCase()]
      if (day) return `El ${pos} ${day} de cada mes`
    }
    return 'Cada mes'
  }

  const custom = r.match(/^WEEKLY:([A-Z,]+)$/i)
  const std = r.match(/BYDAY=([A-Z,]+)/i)
  const dayPart = custom?.[1] ?? std?.[1]
  if (!dayPart) return r.toUpperCase().includes('WEEKLY') ? 'Cada semana' : null
  const labels = dayPart.toUpperCase().split(',').map(d => DAY_LABEL[d.trim()]).filter(Boolean)
  if (!labels.length) return 'Cada semana'
  if (labels.length === 1) return `Cada ${labels[0]}`
  return `Cada ${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`
}

/** ¿El evento ya pasó? Estado derivado, sin mutar la BD. */
export function isPastEvent(e: { start_at: string; end_at: string | null }, now: Date = new Date()): boolean {
  return new Date(e.end_at || e.start_at) < now
}
