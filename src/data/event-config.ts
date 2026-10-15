// Types live in @/types/event — imported here for internal use, re-exported for consumers.
import type { EventType, EventStatus, EventPaymentStatus, AttendanceType, SubEvent, EventRegistration, EventCheckin, VolunteerBooking, AdminEvent, EventTypeEntry } from '@/types/event'
export type { EventType, EventStatus, EventPaymentStatus, AttendanceType, SubEvent, EventRegistration, EventCheckin, VolunteerBooking, AdminEvent, EventTypeEntry }
// Backward-compat alias: PaymentStatus was the original name for EventPaymentStatus in this file.
export type { EventPaymentStatus as PaymentStatus } from '@/types/event'

export const EVENT_STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  upcoming:    { label: 'Próximo',      color: 'teal' },
  in_progress: { label: 'En curso',     color: 'coral' },
  finished:    { label: 'Finalizado',   color: 'navy' },
  cancelled:   { label: 'Cancelado',    color: 'red' },
  archived:    { label: 'Archivado',    color: 'gray' },
}
