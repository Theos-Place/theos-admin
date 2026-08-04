// Paso "dirigente" del alta de un grupo: cuándo se puede avanzar.
//
// Regla (no cambió con el rediseño de 2026-08-04, solo se sacó del JSX para
// poder testearla): se avanza si el dirigente queda PENDIENTE de asignar, o si
// hay uno seleccionado Y confirmado que ya fue contactado.
//
// El CO-DIRIGENTE no participa de la regla: es opcional y hoy no tiene
// confirmación propia.

export type LeaderStepState = {
  /** member_id del dirigente ('' = ninguno). */
  selectedLeader: string
  /** "El dirigente ya fue contactado y confirmó su disponibilidad". */
  confirmed: boolean
  /** "Dejar dirigente pendiente (asignar después)". */
  pendingLeader: boolean
}

export function canAdvanceLeaderStep(s: LeaderStepState): boolean {
  if (s.pendingLeader) return true
  return !!s.selectedLeader && s.confirmed
}

/** Qué falta, para el aviso de la pantalla. null = no falta nada. */
export function leaderStepHint(s: LeaderStepState): string | null {
  if (canAdvanceLeaderStep(s)) return null
  return s.selectedLeader
    ? 'confirmá que el dirigente fue contactado y está disponible'
    : 'seleccioná un dirigente o marcá la opción de dejarlo pendiente'
}
