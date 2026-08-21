// FIN-6 (punto 3) · Quién ve qué devoluciones.
//
// Antes era solo por rol global: finanzas/dirección/admin veían todo y nadie más
// veía nada. Ahora el RESPONSABLE DEL ORIGEN también las ve — el encargado del
// evento las de su evento, la coordinación de estudios las que salen de un plan.
//
// Ven y COMENTAN. Resolver (completar, rechazar, convertir en donación) sigue
// siendo exclusivo de finanzas: eso es plata saliendo.

/** Roles con acceso total: ven todas y resuelven. */
export const REFUND_FINANCE_ROLES = ['finanzas', 'direccion', 'admin'] as const
/** Ve las devoluciones que salen de un plan de estudio (no resuelve). */
export const REFUND_STUDY_ROLES = ['coordinador_estudios', 'coordinador_dirigentes'] as const

export type RefundScope =
  /** Todas, y puede resolver. */
  | { access: 'all'; canResolve: true }
  /** Solo las que salen de un plan de estudio; solo ver y comentar. */
  | { access: 'studies'; canResolve: false }
  /** Solo las de esos eventos; solo ver y comentar. */
  | { access: 'events'; eventIds: string[]; canResolve: false }
  /** Sin acceso. */
  | { access: 'none'; canResolve: false }

/**
 * Alcance a partir de los roles y de los eventos que la persona tiene a cargo.
 *
 * Prioridad: finanzas gana sobre todo (si además es encargado de un evento, ve
 * todo igual). Entre estudios y eventos gana estudios, que es el alcance más
 * amplio de los dos acotados.
 */
export function resolveRefundScope(input: {
  roles: readonly string[]
  managedEventIds?: readonly string[]
}): RefundScope {
  const roles = new Set(input.roles)
  if (REFUND_FINANCE_ROLES.some(r => roles.has(r))) return { access: 'all', canResolve: true }
  if (REFUND_STUDY_ROLES.some(r => roles.has(r))) return { access: 'studies', canResolve: false }

  const eventIds = [...new Set(input.managedEventIds ?? [])]
  if (eventIds.length > 0) return { access: 'events', eventIds, canResolve: false }

  return { access: 'none', canResolve: false }
}

/** Filtros de `getRefunds` que corresponden a un alcance. */
export function scopeToRefundFilters(
  scope: RefundScope,
): { onlyEventIds?: string[]; onlyStudyKinds?: boolean } {
  if (scope.access === 'events') return { onlyEventIds: scope.eventIds }
  if (scope.access === 'studies') return { onlyStudyKinds: true }
  return {}
}
