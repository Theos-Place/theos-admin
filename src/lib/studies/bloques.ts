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

/** Suma meses calendario; si el día no existe en el mes destino (31 ene + 3),
 *  cae al último día de ese mes en vez de desbordarse al siguiente. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, lastDay))
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
}

/** Los cursos del bloque duran 3 meses tras el cierre de matrícula. */
export const BLOQUE_CIERRE_MESES = 3

/** Cierre del bloque (regla 2026-08-18): 3 meses después del cierre de
 *  matrícula. Con la apertura ~2 semanas antes, el bloque dura ~3.5 meses. */
export function bloqueCierre(cierreMatriculaIso: string): string {
  return addMonths(cierreMatriculaIso, BLOQUE_CIERRE_MESES)
}

/** Estado derivado (regla 2026-08-18): un bloque está ACTIVO desde su apertura
 *  hasta su CIERRE DE BLOQUE (cierre de matrícula + 3 meses) — o antes, si un
 *  bloque posterior abre primero (nunca hay dos activos).
 *  `todasLasAperturas` puede incluir la del propio bloque (se ignora). */
export function bloqueEstadoActual(aperturaIso: string, cierreMatriculaIso: string, todasLasAperturas: string[], todayIso: string): BloqueEstado {
  if (todayIso < aperturaIso) return 'en_apertura'
  if (todayIso > bloqueCierre(cierreMatriculaIso)) return 'archivado'
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
