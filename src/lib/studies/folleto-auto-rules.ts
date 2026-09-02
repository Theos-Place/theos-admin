// Cuándo se genera automáticamente un tiquete de folletos (módulo puro).
//
// DECISIÓN 2026-09-02: el CIERRE es el único disparador de la cadena de
// niveles. Se quitaron 'cupo_lleno' y 'fin_matricula' del flujo de matrícula
// porque en la práctica no servían: dependen de que el grupo tenga cupo
// (max_students) o ventana de matrícula (enrollment_end_date), y de los 93
// grupos con folleto propio que estaban abiertos, 78 no tenían ninguno de los
// dos — vienen así de la importación de PCO. Resultado medido: 91 grupos con
// 468 estudiantes sin tiquete, y UN solo tiquete en toda la base, el del
// cierre. Los disparadores existían pero no podían activarse nunca.
//
// Los tipos se conservan en el union porque hay filas históricas con ellos y
// porque prematrimonial sigue usando 'cupo_lleno' — ese caso es distinto: el
// grupo PREMAT nace con la pareja adentro y su cierre no genera sucesor, así
// que si no se pide ahí, la pareja no recibe folleto nunca.
//
// La idempotencia real (1 tiquete por grupo) la garantiza el índice único
// parcial folleto_requests_auto_por_grupo (migración 20260727200000).

export const FIN_MATRICULA_MIN_ENROLLED = 5

/** 'cierre' volvió el 2026-08-27: al cerrar un grupo, quienes aprobaron pasan
 *  automáticamente al nivel siguiente y ESE grupo necesita folletos. Las dos
 *  reglas de FOL-1 no lo cubrían — el grupo sucesor nace sin cupo y sin ventana
 *  de matrícula, así que ni 'cupo_lleno' ni 'fin_matricula' pueden dispararse
 *  nunca para él. */
export type AutoFolletoTipo = 'cupo_lleno' | 'fin_matricula' | 'cierre'

/** Planes con folleto propio: las cadenas de niveles y discípulos, y
 *  prematrimonial (la pareja recibe su folleto al crearse el grupo). */
export function hasOwnFolleto(planCode: string | null | undefined): boolean {
  return !!planCode && (/^N[1-4]$/.test(planCode) || /^DIS[1-3]$/.test(planCode) || planCode === 'PREMAT')
}

export function shouldCreateAutoFolleto(
  tipo: AutoFolletoTipo,
  g: { enrolled: number; max_students: number | null },
): boolean {
  // 'cierre': SIN umbral. Quien aprobó y avanzó necesita su folleto, sean 2 o
  // 20. El mínimo de 5 existe para no pedir folletos de un grupo que quizá no
  // arranca; acá el grupo ya arrancó y la gente ya pasó.
  if (tipo === 'cierre') return g.enrolled > 0
  if (tipo === 'cupo_lleno') return g.max_students != null && g.max_students > 0 && g.enrolled >= g.max_students
  return g.enrolled >= FIN_MATRICULA_MIN_ENROLLED
}
