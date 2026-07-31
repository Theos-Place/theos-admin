// Qué se ve en la ficha de un evento (/eventos/[id]) según los permisos.
//
// Decisión 2026-07-31: la INFORMACIÓN GENERAL de un evento es para cualquier
// persona con sesión — el nombre, la fecha, el lugar, si hay que inscribirse y
// cuánto cuesta. Los demás tabs (inscripciones, check-in, servidores,
// comunicaciones, reportes) son de gestión. Además, si el evento pide
// inscripción, la ficha ofrece el botón de inscribirse: es el mismo modal de la
// lista, para no obligar a volver atrás.
//
// Regla pura: la usan la página, el filtro de tabs y los tests.

export const EVENT_TABS = [
  'informacion', 'inscripciones', 'checkin', 'servidores', 'comunicaciones', 'reportes',
] as const
export type EventTab = (typeof EVENT_TABS)[number]

export type EventTabPerms = {
  /** can('eventos', 'create') — gestión (inscripciones, servidores, comunicaciones). */
  canManage: boolean
  /** can('eventos', 'edit') — check-in. */
  canCheckin: boolean
  /** can('eventos', 'export') — reportes. */
  canReport: boolean
}

/** Tabs visibles. 'informacion' SIEMPRE está: es la parte pública de la ficha. */
export function visibleEventTabs(perms: EventTabPerms): EventTab[] {
  return EVENT_TABS.filter(t =>
    t === 'informacion' ? true
    : t === 'checkin'   ? perms.canCheckin
    : t === 'reportes'  ? perms.canReport
    : perms.canManage,
  )
}

/** ¿Puede ver los datos de GESTIÓN del evento (inscritos, check-ins, cupos
 *  ocupados)? Es lo que decide si el payload del API los incluye. */
export function canSeeEventManagementData(perms: Pick<EventTabPerms, 'canManage' | 'canCheckin' | 'canReport'>): boolean {
  return perms.canManage || perms.canCheckin || perms.canReport
}

export type RegistrationCta =
  /** Botón para inscribirse (abre el modal de confirmación). */
  | { kind: 'inscribirse' }
  /** Ya está inscrito: se muestra el estado, sin botón. */
  | { kind: 'inscrito' }
  /** No puede inscribirse: se explica por qué. */
  | { kind: 'bloqueado'; reasons: string[] }
  /** El evento no pide inscripción, o ya pasó, o está cancelado: nada. */
  | { kind: 'ninguno' }

type EventForCta = {
  requires_registration: boolean
  status: string
  end_at: string
}

type EligForCta = {
  already_registered: boolean
  is_eligible: boolean
  is_full: boolean
  reasons_blocked: string[]
} | null | undefined

/** Qué mostrar en la ficha respecto de la inscripción. `now` se inyecta para
 *  poder testear (nada de Date.now() escondido). */
export function registrationCta(
  event: EventForCta,
  elig: EligForCta,
  now: Date,
): RegistrationCta {
  // Ya inscrito manda sobre todo lo demás: se muestra igual aunque el evento
  // haya pasado (la persona quiere confirmar que quedó inscrita).
  if (elig?.already_registered) return { kind: 'inscrito' }
  if (!event.requires_registration) return { kind: 'ninguno' }
  if (event.status === 'cancelled' || event.status === 'archived') return { kind: 'ninguno' }
  if (new Date(event.end_at).getTime() < now.getTime()) return { kind: 'ninguno' }
  if (!elig) return { kind: 'ninguno' }        // sin elegibilidad calculada aún
  if (elig.is_eligible) return { kind: 'inscribirse' }
  const reasons = elig.reasons_blocked.length
    ? elig.reasons_blocked
    : elig.is_full ? ['El evento ya está lleno.'] : ['No cumplís los requisitos de este evento.']
  return { kind: 'bloqueado', reasons }
}
