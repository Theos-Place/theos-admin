// Adapta una fila `DbEventEnriched` (Supabase + relaciones) al tipo de dominio
// `MockEvent` que consumen las páginas de eventos y calendario.

import type { DbEventEnriched } from '@/lib/supabase/queries/events'
import type { MockEvent, EventType, AttendanceType } from '@/types/event'

function fullName(m: { first_name: string; last_name: string } | null): string {
  if (!m) return ''
  return `${m.first_name} ${m.last_name}`.trim()
}

export function toDomainEvent(db: DbEventEnriched): MockEvent {
  return {
    id: db.id,
    name: db.title,
    event_type: db.event_type as EventType,
    committee_id: db.committee_id ?? '',
    description: db.description ?? '',
    start_at: db.starts_at,
    end_at: db.ends_at ?? db.starts_at,
    location: db.location ?? '',
    location_map_url: db.location_url,
    is_virtual: db.is_virtual,
    requires_registration: db.requires_registration,
    max_capacity: db.max_capacity ?? 0,
    requires_payment: db.requires_payment,
    payment_amount: db.payment_amount,
    requires_survey: db.requires_survey,
    status: db.status,
    is_recurring: db.is_recurring,
    recurrence_rule: db.recurrence_rule,
    recurrence_end: db.recurrence_end,
    parent_event_id: db.parent_event_id,
    flyer_url: db.flyer_url,
    cancellation_reason: db.cancellation_reason,

    sub_events: db.sub_events.map((s) => ({
      id: s.id,
      name: s.name,
      max_capacity: s.max_capacity,
    })),

    registrations: db.registrations.map((r) => ({
      member_id: r.member_id,
      member_name: fullName(r.member),
      payment_status: r.payment_status,
      registered_at: r.registered_at,
    })),

    checkins: db.checkins.map((c) => ({
      member_id: c.member_id ?? '',
      member_name: fullName(c.member),
      attendance_type: (c.is_volunteer ? 'server' : 'participant') as AttendanceType,
      sub_event_id: c.sub_event_id,
      checked_at: c.checked_in_at,
    })),

    volunteer_bookings: db.volunteers.map((v) => ({
      member_id: v.member_id,
      member_name: fullName(v.member),
      role: v.role ?? '',
      status: v.status,
    })),
  }
}
