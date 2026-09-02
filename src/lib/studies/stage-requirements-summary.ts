// MAT-1: resumen estructurado y mínimo de los requisitos de una etapa para el
// empty-state de matrícula. Trabaja sobre RequirementsStatus (datos, no parseo
// de strings). Reglas:
//   · Prerequisitos: solo el MÍNIMO real de cada cadena (si entre los gateway
//     faltan N2 y N4, se muestra N2 — nunca dos niveles de la misma cadena);
//   · Compromisos: etiquetas cortas de sistema, deduplicados (una sola vez),
//     con el detalle largo como texto secundario;
//   · Cumplido si CUALQUIER gateway lo marca cumplido (los compromisos son de
//     etapa: si uno lo da por bueno, está bueno).

import type { RequirementsStatus } from '@/lib/studies/eligibility'

const CHAINS: string[][] = [['N1', 'N2', 'N3', 'N4'], ['DIS1', 'DIS2', 'DIS3']]

export type StageSummaryItem = { key: string; label: string; detail?: string }

export type StageRequirementsSummary = {
  met: StageSummaryItem[]
  missing: StageSummaryItem[]
}

const COMMITMENT_LABELS: Record<'donor' | 'server' | 'attendance', string> = {
  donor: 'Donante/a activo/a',
  server: 'Servidor/a en comité',
  attendance: 'Asistencia activa',
}

/** Reduce códigos de prerequisito faltantes al mínimo por cadena. */
export function minimalMissingPrerequisites(codes: string[]): string[] {
  const set = new Set(codes)
  const out: string[] = []
  for (const chain of CHAINS) {
    const inChain = chain.filter(c => set.has(c))
    if (inChain.length > 0) {
      out.push(inChain[0]) // chain está en orden: el primero es el mínimo
      inChain.forEach(c => set.delete(c))
    }
  }
  return [...out, ...set] // códigos fuera de las cadenas, tal cual
}

export function summarizeStageRequirements(
  results: Array<{ is_eligible: boolean; requirements: RequirementsStatus }>,
  planNameByCode: (code: string) => string,
): StageRequirementsSummary {
  const met: StageSummaryItem[] = []
  const missing: StageSummaryItem[] = []

  // Prerequisitos: solo de los NO elegibles (los elegibles ya pasaron).
  const missingPrereqs = results
    .filter(r => !r.is_eligible && r.requirements.missing_prerequisite)
    .map(r => r.requirements.missing_prerequisite!)
  for (const code of minimalMissingPrerequisites(missingPrereqs)) {
    missing.push({ key: `prereq:${code}`, label: `Completar ${planNameByCode(code)}` })
  }

  // Compromisos: aplica si algún resultado lo define; cumplido si alguno lo cumple.
  for (const k of ['donor', 'server', 'attendance'] as const) {
    const applicable = results.filter(r => r.requirements[k] !== undefined)
    if (applicable.length === 0) continue
    const ok = applicable.some(r => r.requirements[k] === true)
    const detail = k === 'attendance'
      ? applicable.map(r => r.requirements.attendance_detail).find(Boolean)
      : undefined
    const item = { key: k, label: COMMITMENT_LABELS[k], detail }
    if (ok) met.push(item)
    else missing.push(item)
  }

  return { met, missing }
}
