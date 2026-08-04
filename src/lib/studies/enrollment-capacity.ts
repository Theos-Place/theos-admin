// Cupo de un grupo de estudio (regla pura, testeable sin Supabase).
//
// Contexto (2026-08-04): la matrícula pasó a ser EFECTIVA de inmediato, aunque
// el estudio tenga costo — el pago es un carril aparte. Antes, una matrícula con
// costo nacía 'pendiente_de_pago' y el cupo se "reservaba"; hoy se ocupa de una.
// Por eso el cupo se valida en el SERVIDOR al matricular: antes solo lo filtraba
// la UI, y con matrícula inmediata dos personas entrando a la vez pasaban del
// tope sin que nadie se enterara.

/** Estados de una inscripción que OCUPAN cupo en el grupo.
 *  'pendiente_de_pago' sigue en la lista por las matrículas viejas: ya no se
 *  escribe, pero las que quedaron siguen ocupando su campo. */
export const OCCUPYING_STATUSES = [
  'enrolled', 'pendiente_de_pago', 'waitlist', 'completed', 'reprobado',
] as const

/** Estados que LIBERAN el cupo (la persona ya no está en el grupo). */
export const RELEASING_STATUSES = ['dropped', 'withdrawn', 'transferred', 'expirada'] as const

export function occupiesSpot(status: string | null | undefined): boolean {
  return !!status && (OCCUPYING_STATUSES as readonly string[]).includes(status)
}

/**
 * ¿El grupo está lleno para UNA persona más?
 * `activeCount` NO debe incluir a quien se está matriculando (una persona que
 * ya está en el grupo y se re-matricula no consume un cupo nuevo).
 * Sin cupo declarado (null o 0) no hay tope: el grupo no se llena.
 */
export function isGroupFull(input: {
  activeCount: number
  maxCapacity: number | null | undefined
}): boolean {
  const max = input.maxCapacity ?? 0
  if (max <= 0) return false
  return input.activeCount >= max
}

/** Mensaje del 409 al matricular en un grupo lleno. */
export function groupFullMessage(maxCapacity: number | null | undefined): string {
  const max = maxCapacity ?? 0
  return max > 0
    ? `Este grupo ya llegó a su cupo (${max}). Elegí otro grupo o ampliá el cupo desde el detalle del grupo.`
    : 'Este grupo ya llegó a su cupo.'
}
