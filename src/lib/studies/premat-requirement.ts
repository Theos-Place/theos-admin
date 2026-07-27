// PRE-5 (regla 2026-07-26): requisito del curso prematrimonial para AMBOS de
// la pareja — N1 COMPLETADO y estar al menos INSCRITO en N2 ('enrolled' o
// 'completed'; waitlist y pendiente_de_pago NO cuentan). Relaja la regla
// anterior (N2 completado).
//
// Completar un nivel posterior de la cadena implica los anteriores (mismo
// criterio que completedDescendant en la elegibilidad): así nadie que cumplía
// la regla vieja queda fuera con la nueva, aunque su N1 no esté registrado
// (histórico importado, reubicaciones, excepciones).
//
// Nota: study_plans.prerequisite_code de PREMAT sigue en 'N2' — solo lo usa la
// elegibilidad genérica de matrícula (donde PREMAT no se ofrece; la entrada
// real es el wizard, que valida con esta regla).

const N_CHAIN = ['N1', 'N2', 'N3', 'N4']

function completedAtOrAfter(completed: Set<string>, code: string): boolean {
  const i = N_CHAIN.indexOf(code)
  if (i === -1) return completed.has(code)
  return N_CHAIN.slice(i).some(c => completed.has(c))
}

export function meetsPrematRequirementFromCodes(completedCodes: string[], enrolledCodes: string[]): boolean {
  const completed = new Set(completedCodes)
  const n1ok = completedAtOrAfter(completed, 'N1')
  const n2ok = completedAtOrAfter(completed, 'N2') || enrolledCodes.includes('N2')
  return n1ok && n2ok
}

/** Mensaje único del requisito, para 409/copy de UI. */
export const PREMAT_REQUIREMENT_LABEL = 'Nivel 1 completado y estar inscrito en Nivel 2'
