// Events domain types.

export type EventType = 'charla' | 'campamento' | 'social' | 'capacitacion'
export type EventStatus = 'upcoming' | 'in_progress' | 'finished' | 'cancelled' | 'archived'

/**
 * Payment status for event registrations.
 * Note: different from the finance PaymentStatus in @/types/finance.
 */
export type EventPaymentStatus = 'pending' | 'paid' | 'exempted'

export type AttendanceType = 'participant' | 'server'

export type SubEvent = {
  id: string
  name: string
  max_capacity: number
}

export type EventRegistration = {
  member_id: string
  member_name: string
  payment_status: EventPaymentStatus
  registered_at: string
}

export type EventCheckin = {
  id: string
  member_id: string
  member_name: string
  attendance_type: AttendanceType
  sub_event_id: string | null
  checked_at: string
}

export type VolunteerBooking = {
  member_id: string
  member_name: string
  role: string
  status: 'confirmed' | 'pending' | 'cancelled'
}

export type MockEvent = {
  id: string
  name: string
  event_type: EventType
  committee_id: string
  description: string
  start_at: string
  end_at: string
  location: string
  location_map_url: string | null
  is_virtual: boolean
  virtual_url: string | null
  requires_registration: boolean
  /** null = sin límite de cupo (default). */
  max_capacity: number | null
  requires_payment: boolean
  payment_amount: number | null
  /** Precio para servidores de los comités organizadores. null = igual al normal. */
  server_price: number | null
  /** false = servidores del comité organizador exentos de pago. */
  servers_pay: boolean
  /** Ids de áreas-comité organizadoras (m2m). */
  organizing_committee_ids: string[]
  requires_survey: boolean
  status: EventStatus
  is_recurring: boolean
  recurrence_rule: string | null
  recurrence_end: string | null
  parent_event_id: string | null
  /** Fechas (YYYY-MM-DD, hora CR) de ocurrencias exceptuadas de la serie: se
   *  excluyen de la expansión (canceladas o reemplazadas por un override). */
  exception_dates: string[]
  sub_events: SubEvent[]
  registrations: EventRegistration[]
  checkins: EventCheckin[]
  volunteer_bookings: VolunteerBooking[]
  cancellation_reason: string | null
  flyer_url: string | null
  /** false = evento de import histórico; va al calendario y a "Realizados", no a "Próximos". */
  is_active?: boolean
}

export type EventTypeEntry = {
  id: string
  name: string
  color: string
  icon: string
  description: string
  is_active: boolean
}
