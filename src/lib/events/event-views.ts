// Derivaciones de eventos compartidas por TODAS las vistas (lista, grid,
// calendario, calendario público y export ICS) para que no haya discrepancias.
// Todas se apoyan en expand-recurrence.ts.

import type { AdminEvent } from '@/types/event'
import { expandRecurring } from './expand-recurrence'

/**
 * Eventos de un mes: puntuales con start_at en el mes + ocurrencias virtuales de
 * recurrentes dentro de la ventana. Lo usan el calendario interno y el público.
 */
export function monthEvents(events: AdminEvent[], month: number, year: number): AdminEvent[] {
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
export function eventsInRange(events: AdminEvent[], from: Date, to: Date): AdminEvent[] {
  const inRange = events.filter(e => {
    const d = new Date(e.start_at)
    return d >= from && d < to
  })
  const occurrences = events.flatMap(e => expandRecurring(e, from, to))
  return [...inRange, ...occurrences].sort((a, b) => a.start_at.localeCompare(b.start_at))
}
