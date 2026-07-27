// EST-1: regla "nunca un dirigente inactivo con grupo activo" (en_matricula o
// en_curso). Excepción: los estudios tipo campaña (study_plans.level =
// 'campanas') quedan fuera — dirigir una campaña ni activa automáticamente al
// dirigente ni bloquea su desactivación. Módulo puro.

export const CAMPAIGN_LEVEL = 'campanas'

/** ¿Un grupo de este plan "amarra" a su dirigente (activación automática al
 *  asignar + bloqueo de desactivación mientras el grupo esté activo)? */
export function groupLocksLeader(planLevel: string | null | undefined): boolean {
  return planLevel !== CAMPAIGN_LEVEL
}

/** ¿Hay que activar automáticamente al dirigente al asignarlo a este grupo? */
export function shouldAutoActivateLeader(
  planLevel: string | null | undefined,
  leaderIsActive: boolean | null | undefined,
): boolean {
  return groupLocksLeader(planLevel) && !leaderIsActive
}
