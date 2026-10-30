/**
 * EVE-14 (2026-10-30) · Los totales REALES de un evento con inscripción.
 *
 * Dos cosas que el resumen no decía: (1) las inscripciones por el link
 * público sin ficha también son gente que viene, y (2) una inscripción puede
 * cubrir a más de una persona (Matrimonios: la pareja). El multiplicador sale
 * del evento (`personas_por_inscripcion`), no de un «pareja» escrito a mano.
 *
 * Módulo PURO, con tests.
 */

export type TotalesDeInscripcion = {
  /** Inscripciones con ficha. */
  conFicha: number
  /** Inscripciones por el link público, sin ficha todavía. */
  sinFicha: number
  /** Las dos juntas. */
  inscripciones: number
  /** Cuántas personas cubre cada inscripción. */
  personasPorInscripcion: number
  /** inscripciones × personasPorInscripcion. */
  asistentesEstimados: number
}

export function totalesDeInscripcion(i: {
  conFicha: number
  sinFicha?: number | null
  personasPorInscripcion?: number | null
}): TotalesDeInscripcion {
  const sinFicha = Math.max(0, i.sinFicha ?? 0)
  const ppi = Math.max(1, Math.round(i.personasPorInscripcion ?? 1))
  const inscripciones = i.conFicha + sinFicha
  return { conFicha: i.conFicha, sinFicha, inscripciones, personasPorInscripcion: ppi, asistentesEstimados: inscripciones * ppi }
}

/** «13 inscripciones · ~26 asistentes» (el estimado solo si el multiplicador es > 1). */
export function textoDeTotales(t: TotalesDeInscripcion): string {
  const n = t.inscripciones
  const base = `${n} ${n === 1 ? 'inscripción' : 'inscripciones'}`
  if (t.personasPorInscripcion <= 1) return base
  return `${base} · ~${t.asistentesEstimados} asistentes`
}

/** La línea de desglose cuando hay inscritos por el link sin ficha. */
export function textoDeSinFicha(t: TotalesDeInscripcion): string | null {
  if (t.sinFicha === 0) return null
  return `${t.conFicha} con ficha + ${t.sinFicha} por el link sin ficha`
}

/** Ocupación en PERSONAS: el cupo del evento se compara con los asistentes estimados. */
export function ocupacion(t: TotalesDeInscripcion, maxCapacity: number | null | undefined): { usado: number; cupo: number | null; porcentaje: number } {
  const cupo = maxCapacity && maxCapacity > 0 ? maxCapacity : null
  const usado = t.asistentesEstimados
  return { usado, cupo, porcentaje: cupo ? Math.round((usado / cupo) * 100) : 0 }
}
