// Bloques de capacitación — reglas y etiquetas (módulo puro, cliente + servidor).

/** Una capacitación es cualquier estudio que NO sea Nivel 1-4 ni Discípulos 2-3. */
export const CAPACITACION_EXCLUDED_CODES = ['N1', 'N2', 'N3', 'N4', 'DIS2', 'DIS3']

export function isCapacitacion(code: string | null | undefined): boolean {
  return !!code && !CAPACITACION_EXCLUDED_CODES.includes(code)
}

// ── Hitos derivados de la fecha de apertura ──────────────────────────────────
// preliminar = apertura − 3 semanas · confirmación = apertura − 2 semanas ·
// final = fecha de cierre de matrícula.
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type BloqueMilestone = 'preliminar' | 'confirmacion' | 'final'

export function bloqueMilestones(aperturaIso: string, cierreIso: string): Record<BloqueMilestone, string> {
  return {
    preliminar: addDays(aperturaIso, -21),
    confirmacion: addDays(aperturaIso, -14),
    final: cierreIso,
  }
}

/** Tipo de folleto_requests según el hito. */
export const MILESTONE_TO_TIPO: Record<BloqueMilestone, string> = {
  preliminar: 'preapertura_preliminar',
  confirmacion: 'preapertura_confirmacion',
  final: 'preapertura_final',
}

// ── Etiquetas de tipo de folleto ─────────────────────────────────────────────
// FOL-1: cupo_lleno/fin_matricula son las reglas vigentes; cierre y
// preapertura_* quedan solo por los datos históricos (ya no se generan).
export type FolletoTipo = 'cierre' | 'preapertura_preliminar' | 'preapertura_confirmacion' | 'preapertura_final' | 'manual' | 'cupo_lleno' | 'fin_matricula'

export const FOLLETO_TIPO_LABEL: Record<FolletoTipo, string> = {
  cierre: 'Cierre',
  preapertura_preliminar: 'Preapertura · Preliminar',
  preapertura_confirmacion: 'Preapertura · Confirmación',
  preapertura_final: 'Preapertura · Final',
  manual: 'Manual (caso especial)',
  cupo_lleno: 'Cupo lleno',
  fin_matricula: 'Fin de matrícula',
}

export const FOLLETO_TIPO_BADGE: Record<FolletoTipo, string> = {
  cierre: 'bg-navy-light/10 text-navy-light/70',
  preapertura_preliminar: 'bg-amber-50 text-amber-700',
  preapertura_confirmacion: 'bg-teal-deep/10 text-teal-deep',
  preapertura_final: 'bg-coral/10 text-coral',
  manual: 'bg-coral/15 text-coral-deep',
  cupo_lleno: 'bg-teal-soft/30 text-teal-deep',
  fin_matricula: 'bg-navy/10 text-navy',
}

// ── Estado derivado de fechas (no manual) ────────────────────────────────────
export type BloqueEstado = 'en_apertura' | 'activo' | 'archivado'

/** Vigencia por cuatrimestre (regla 2026-08-17): un bloque está ACTIVO desde su
 *  apertura hasta que abre el siguiente bloque — no solo durante la ventana de
 *  matrícula. Por eso el estado depende de las aperturas de TODOS los bloques:
 *  - en_apertura: la apertura todavía no llega.
 *  - activo: ya abrió y ningún bloque posterior ha abierto.
 *  - archivado: un bloque posterior ya abrió.
 *  `todasLasAperturas` puede incluir la del propio bloque (se ignora). */
export function bloqueEstadoActual(aperturaIso: string, todasLasAperturas: string[], todayIso: string): BloqueEstado {
  if (todayIso < aperturaIso) return 'en_apertura'
  const abrioUnoPosterior = todasLasAperturas.some(a => a > aperturaIso && a <= todayIso)
  return abrioUnoPosterior ? 'archivado' : 'activo'
}

export const BLOQUE_ESTADO_LABEL: Record<BloqueEstado, string> = {
  en_apertura: 'En apertura',
  activo: 'Activo',
  archivado: 'Archivado',
}

export const BLOQUE_ESTADO_BADGE: Record<BloqueEstado, string> = {
  en_apertura: 'bg-amber-50 text-amber-700',
  activo: 'bg-teal-soft/30 text-teal-deep',
  archivado: 'bg-navy-light/10 text-navy-light/70',
}

/** Tres bloques sugeridos por defecto para un año (ene/may/sep — fechas editables). */
export function suggestedBlocksForYear(year: number): Array<{ nombre: string; fecha_apertura: string; fecha_cierre_matricula: string }> {
  // Meses sugeridos: enero, mayo, septiembre. Apertura ~día 15; cierre ~apertura+7.
  const months = [0, 4, 8]
  return months.map((m, i) => {
    const apertura = `${year}-${String(m + 1).padStart(2, '0')}-15`
    return {
      nombre: `Bloque ${i + 1} ${year}`,
      fecha_apertura: apertura,
      fecha_cierre_matricula: addDays(apertura, 7),
    }
  })
}
