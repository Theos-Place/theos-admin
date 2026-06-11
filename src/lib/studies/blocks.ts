/**
 * Bloques anuales de capacitaciones (Inicial e Intermedia):
 *   Bloque 1: enero–abril · Bloque 2: mayo–agosto · Bloque 3: septiembre–diciembre
 * El análisis de demanda siempre calcula para el bloque SIGUIENTE al actual.
 * La matrícula (~15 días) abre un mes antes de que arranque el bloque siguiente.
 */

/** Tamaño objetivo de un grupo para estimar cuántos abrir. */
export const GROUP_SIZE = 12
/** Demanda mínima para sugerir abrir un grupo: con menos de esto, 0 grupos. */
export const MIN_DEMAND_FOR_GROUP = 5

/** Grupos sugeridos para una demanda dada (aplica el umbral mínimo). */
export function suggestedGroups(demand: number): number {
  return demand < MIN_DEMAND_FOR_GROUP ? 0 : Math.ceil(demand / GROUP_SIZE)
}

export type BlockInfo = { block: 1 | 2 | 3; label: string; endsAt: Date }
export type NextBlockInfo = { block: 1 | 2 | 3; label: string; startsAt: Date; enrollmentOpens: Date }

const BLOCK_NAMES: Record<1 | 2 | 3, string> = {
  1: 'Enero–Abril',
  2: 'Mayo–Agosto',
  3: 'Septiembre–Diciembre',
}

function blockOfMonth(month: number): 1 | 2 | 3 {
  if (month <= 3) return 1   // ene(0)–abr(3)
  if (month <= 7) return 2   // may(4)–ago(7)
  return 3                   // sep(8)–dic(11)
}

export function getCurrentBlock(date: Date): BlockInfo {
  const block = blockOfMonth(date.getMonth())
  const year = date.getFullYear()
  // Fin del bloque: último día de abril / agosto / diciembre.
  const endMonth = block * 4 // 4, 8, 12 → Date(y, m, 0) = último día del mes anterior
  return {
    block,
    label: `Bloque ${block} (${BLOCK_NAMES[block]} ${year})`,
    endsAt: new Date(year, endMonth, 0),
  }
}

export function getNextBlock(date: Date): NextBlockInfo {
  const current = blockOfMonth(date.getMonth())
  const year = date.getFullYear()
  const block = (current === 3 ? 1 : current + 1) as 1 | 2 | 3
  const startYear = current === 3 ? year + 1 : year
  const startsAt = new Date(startYear, (block - 1) * 4, 1) // 1 ene / 1 may / 1 sep
  // La matrícula abre un mes antes del inicio del bloque.
  const enrollmentOpens = new Date(startYear, (block - 1) * 4 - 1, 1)
  return {
    block,
    label: `Bloque ${block} (${BLOCK_NAMES[block]} ${startYear})`,
    startsAt,
    enrollmentOpens,
  }
}
