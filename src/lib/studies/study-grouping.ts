// Agrupación SOLO de presentación de estudios para la página de Dirigentes.
// El modelo de datos sigue guardando los códigos individuales (N1..N4, DIS1..DIS3);
// acá se colapsan en grupos "Niveles" y "Discípulos" para mostrar, editar en bloque
// y filtrar. No toca la BD.

export type StudyGroupKey = 'niveles' | 'discipulos'

export const STUDY_GROUPS: Record<StudyGroupKey, { label: string; codes: string[] }> = {
  niveles:    { label: 'Niveles',    codes: ['N1', 'N2', 'N3', 'N4'] },
  discipulos: { label: 'Discípulos', codes: ['DIS1', 'DIS2', 'DIS3'] },
}

/** code → grupo al que pertenece (o undefined si es un estudio individual). */
const GROUP_OF_CODE: Record<string, StudyGroupKey> = Object.entries(STUDY_GROUPS)
  .reduce((acc, [key, g]) => { g.codes.forEach(c => { acc[c] = key as StudyGroupKey }); return acc }, {} as Record<string, StudyGroupKey>)

export type DisplayBadge = {
  /** Clave única para React/onClick: 'GRP:niveles' | 'GRP:discipulos' | el code. */
  value: string
  label: string
  /** Códigos reales que representa (1 para individuales, varios para grupos). */
  codes: string[]
}

/** Colapsa una lista de códigos en badges de presentación: "Niveles"/"Discípulos"
 *  + los demás estudios individuales.
 *
 *  El grupo NO se marca como parcial: dar un estudio de Niveles habilita para dar
 *  todos, así que tener N1 vale igual que tener N1–N4 y el badge dice "Niveles". */
export function groupCodesForDisplay(codes: string[], labelOf: (code: string) => string): DisplayBadge[] {
  const set = new Set(codes)
  const out: DisplayBadge[] = []
  const usedGroups = new Set<StudyGroupKey>()

  for (const code of codes) {
    const gk = GROUP_OF_CODE[code]
    if (gk) {
      if (usedGroups.has(gk)) continue
      usedGroups.add(gk)
      const g = STUDY_GROUPS[gk]
      out.push({ value: `GRP:${gk}`, label: g.label, codes: g.codes.filter(c => set.has(c)) })
    } else {
      out.push({ value: code, label: labelOf(code), codes: [code] })
    }
  }
  return out
}

/** Opciones para selects (filtros, agregar): grupos primero, luego estudios
 *  individuales que NO pertenecen a ningún grupo. `value` es 'GRP:<key>' o el code. */
export function studySelectOptions(allTypes: Array<{ code: string; name: string }>): Array<{ value: string; label: string }> {
  const groupOpts = (Object.keys(STUDY_GROUPS) as StudyGroupKey[]).map(k => ({ value: `GRP:${k}`, label: STUDY_GROUPS[k].label }))
  const individual = allTypes
    .filter(t => !GROUP_OF_CODE[t.code])
    .map(t => ({ value: t.code, label: `${t.code} — ${t.name}` }))
  return [...groupOpts, ...individual]
}

/** Expande un value de opción a los códigos reales que representa. */
export function expandSelectionValue(value: string): string[] {
  if (value.startsWith('GRP:')) {
    const gk = value.slice(4) as StudyGroupKey
    return STUDY_GROUPS[gk]?.codes ?? []
  }
  return [value]
}

/** ¿La lista de códigos `codes` matchea el filtro `value`? Para grupos: matchea si
 *  tiene AL MENOS UNO de los códigos del grupo (más útil para encontrar dirigentes). */
export function matchesStudyFilter(codes: string[], value: string): boolean {
  if (!value) return true
  const wanted = expandSelectionValue(value)
  return codes.some(c => wanted.includes(c))
}
