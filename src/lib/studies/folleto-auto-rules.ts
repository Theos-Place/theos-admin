// FOL-1: cuándo se genera automáticamente un tiquete de folletos (módulo puro).
// Las reglas nuevas REEMPLAZAN la generación por cierre de grupo y por hitos:
//   · cupo_lleno:    al confirmar una matrícula, si enrolled llegó al cupo;
//   · fin_matricula: al vencer la ventana de matrícula (GRU-1), con >= 5.
// El folleto es del PROPIO nivel del grupo (la gente que se matricula lo va a
// cursar), a diferencia de la regla vieja de cierre que pedía el siguiente.
// La idempotencia real (1 tiquete por grupo) la garantiza el índice único
// parcial folleto_requests_auto_por_grupo (migración 20260727200000).

export const FIN_MATRICULA_MIN_ENROLLED = 5

export type AutoFolletoTipo = 'cupo_lleno' | 'fin_matricula'

/** Planes con folleto propio: las cadenas de niveles y discípulos, y
 *  prematrimonial (la pareja recibe su folleto al crearse el grupo). */
export function hasOwnFolleto(planCode: string | null | undefined): boolean {
  return !!planCode && (/^N[1-4]$/.test(planCode) || /^DIS[1-3]$/.test(planCode) || planCode === 'PREMAT')
}

export function shouldCreateAutoFolleto(
  tipo: AutoFolletoTipo,
  g: { enrolled: number; max_students: number | null },
): boolean {
  if (tipo === 'cupo_lleno') return g.max_students != null && g.max_students > 0 && g.enrolled >= g.max_students
  return g.enrolled >= FIN_MATRICULA_MIN_ENROLLED
}
