// Derivaciones de eventos compartidas por TODAS las vistas (lista, grid,
// calendario, calendario público y export ICS) para que no haya discrepancias.
// Todas se apoyan en expand-recurrence.ts.

import type { MockEvent } from '@/types/event'
import { expandRecurring, nextOccurrence, isPastEvent } from './expand-recurrence'

/**
 * Próximos eventos: los recurrentes aparecen UNA vez con su próxima ocurrencia
 * (virtual, fechas desplazadas); los puntuales futuros tal cual. Orden ascendente.
 * Excluye inactivos. Lo usan la lista y el grid.
 */
export function upcomingEvents(events: MockEvent[], now: Date = new Date()): MockEvent[] {
  const out: MockEvent[] = []
  for (const e of events) {
    if (e.is_active === false) continue
    if (e.is_recurring && e.recurrence_rule) {
      const next = nextOccurrence(e, now)
      if (!next) continue
      const dur = Math.max(0, new Date(e.end_at).getTime() - new Date(e.start_at).getTime())
      out.push({
        ...e,
        start_at: next.toISOString(),
        end_at: new Date(next.getTime() + dur).toISOString(),
      })
    } else if (!isPastEvent(e, now)) {
      out.push(e)
    }
  }
  return out.sort((a, b) => a.start_at.localeCompare(b.start_at))
}

/**
 * Eventos de un mes: puntuales con start_at en el mes + ocurrencias virtuales de
 * recurrentes dentro de la ventana. Lo usan el calendario interno y el público.
 */
export function monthEvents(events: MockEvent[], month: number, year: number): MockEvent[] {
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 1)
  const inMonth = events.filter(e => {
    const d = new Date(e.start_at)
    return d >= from && d < to
  })
  const occurrences = events.flatMap(e => expandRecurring(e, from, to))
  return [...inMonth, ...occurrences]
}

/** Eventos en una ventana de fechas arbitraria (puntuales + ocurrencias). */
export function eventsInRange(events: MockEvent[], from: Date, to: Date): MockEvent[] {
  const inRange = events.filter(e => {
    const d = new Date(e.start_at)
    return d >= from && d < to
  })
  const occurrences = events.flatMap(e => expandRecurring(e, from, to))
  return [...inRange, ...occurrences].sort((a, b) => a.start_at.localeCompare(b.start_at))
}
