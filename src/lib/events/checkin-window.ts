/**
 * Criterio del SELECTOR DE CHECK-IN (solo del día): eventos cuyo starts_at es HOY
 * (hora CR) y siguen dentro de su ventana activa — desde el inicio del día hasta
 * ends_at + CHECKIN_GRACE_HOURS (o starts_at + gracia si no hay ends_at). Incluye
 * ocurrencias de recurrentes (expandidas). Distinto del filtro "próximos" de la
 * lista de eventos: acá un evento que YA empezó sigue visible.
 */
import type { MockEvent } from '@/types/event'
import { eventsInRange } from './event-views'
import { CHECKIN_GRACE_HOURS } from '@/lib/constants'

export type CheckinStatus = 'en_curso' | 'por_iniciar' | 'recien_terminado'
export type CheckinCandidate = MockEvent & { checkin_status: CheckinStatus }

export const CHECKIN_STATUS_LABEL: Record<CheckinStatus, string> = {
  en_curso: 'En curso',
  por_iniciar: 'Por iniciar',
  recien_terminado: 'Recién terminado',
}

/** Eventos de HOY disponibles para check-in (dentro de su ventana de gracia),
 *  ordenados por hora de inicio, con su estado. */
export function todaysCheckinEvents(events: MockEvent[], now: Date = new Date()): CheckinCandidate[] {
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1)

  const graceMs = CHECKIN_GRACE_HOURS * 3600 * 1000
  const out: CheckinCandidate[] = []
  for (const e of eventsInRange(events, startOfDay, endOfDay)) {
    const start = new Date(e.start_at)
    // Fin para el estado: ends_at, o starts_at+gracia si no hay ends_at.
    const end = e.end_at ? new Date(e.end_at) : new Date(start.getTime() + graceMs)
    // Visibilidad: hasta (ends_at ?? starts_at) + gracia.
    const windowEnd = (e.end_at ? new Date(e.end_at).getTime() : start.getTime()) + graceMs
    if (now.getTime() > windowEnd) continue // ya pasó la ventana de gracia
    const status: CheckinStatus =
      now < start ? 'por_iniciar'
      : now <= end ? 'en_curso'
      : 'recien_terminado'
    out.push({ ...e, checkin_status: status })
  }
  return out.sort((a, b) => a.start_at.localeCompare(b.start_at))
}
