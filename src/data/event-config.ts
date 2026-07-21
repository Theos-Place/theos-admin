// Types live in @/types/event — imported here for internal use, re-exported for consumers.
import type { EventType, EventStatus, EventPaymentStatus, AttendanceType, SubEvent, EventRegistration, EventCheckin, VolunteerBooking, AdminEvent, EventTypeEntry } from '@/types/event'
export type { EventType, EventStatus, EventPaymentStatus, AttendanceType, SubEvent, EventRegistration, EventCheckin, VolunteerBooking, AdminEvent, EventTypeEntry }
// Backward-compat alias: PaymentStatus was the original name for EventPaymentStatus in this file.
export type { EventPaymentStatus as PaymentStatus } from '@/types/event'

export const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string }> = {
  charla:       { label: 'Charla',       color: 'navy' },
  campamento:   { label: 'Campamento',   color: 'teal' },
  social:       { label: 'Social',       color: 'coral' },
  capacitacion: { label: 'Capacitación', color: 'amber' },
}

/** Config de un tipo de evento, con fallback para tipos custom/desconocidos
 *  (el catálogo de la BD permite tipos que no están en EVENT_TYPE_CONFIG; sin
 *  este fallback, leerles .color/.label rompía la página de eventos). */
export function eventTypeConfig(type: string): { label: string; color: string } {
  return EVENT_TYPE_CONFIG[type as EventType] ?? { label: type || 'Evento', color: 'navy' }
}

export const EVENT_STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  upcoming:    { label: 'Próximo',      color: 'teal' },
  in_progress: { label: 'En curso',     color: 'coral' },
  finished:    { label: 'Finalizado',   color: 'navy' },
  cancelled:   { label: 'Cancelado',    color: 'red' },
  archived:    { label: 'Archivado',    color: 'gray' },
}
