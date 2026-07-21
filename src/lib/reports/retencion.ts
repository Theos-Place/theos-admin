// Cálculo del reporte "Retención y Transición en Grupos". Módulo PURO: toma las
// filas por persona/año/grupo del RPC `get_group_attendance` y arma únicos por
// grupo/año, retención año a año, flujo de transición y proyección. Server-side.
//
// Clasificación SOLO por edad al asistir (ver migración 20260721040000). Los
// grupos G1a/G1b/G1c se consolidan en G1 para las vistas principales.

export type GroupAttRow = {
  person_id: string
  yr: number
  grp: string        // 'G1a' | 'G1b' | 'G1c' | 'G2' | 'G3' | 'G4'
  visits: number
  max_age: number
}

/** Grupos principales (G1 consolida a G1a/b/c). */
export const MAIN_GROUPS = ['G1', 'G2', 'G3', 'G4'] as const
export type MainGroup = typeof MAIN_GROUPS[number]
export const G1_SUBS = ['G1a', 'G1b', 'G1c'] as const

export const GROUP_LABELS: Record<string, string> = {
  G1: 'G1 · Niños (2-12)',
  G1a: 'G1a · 2-4',
  G1b: 'G1b · 5-8',
  G1c: 'G1c · 9-12',
  G2: 'G2 · Jóvenes (13-17)',
  G3: 'G3 · Adultos jóvenes (18-32)',
  G4: 'G4 · Adultos mayores (>32)',
}

// Tope de edad de cada grupo y su grupo destino (para el flujo de transición).
const GROUP_TOP_AGE: Record<string, number> = { G1: 12, G2: 17, G3: 32 }
const NEXT_GROUP: Record<string, MainGroup> = { G1: 'G2', G2: 'G3', G3: 'G4' }

/** Mapea un grupo crudo (G1a/b/c) a su grupo principal (G1). */
function mainOf(grp: string): MainGroup | null {
  if (grp === 'G1a' || grp === 'G1b' || grp === 'G1c') return 'G1'
  if ((MAIN_GROUPS as readonly string[]).includes(grp)) return grp as MainGroup
  return null
}

export type YearCount = { year: number; count: number }
export type RetentionPoint = { fromYear: number; toYear: number; base: number; retained: number; rate: number }
export type FlowSummary = { base: number; siguen: number; transicionaron: number; perdidos: number; dropout: number }
export type ProjectionPoint = { year: number; value: number; projected: boolean }

export type RetencionReport = {
  years: number[]
  coverageNote: string
  // Únicos por grupo/año (grupos principales) y subgrupos de G1.
  uniquesByGroup: Record<MainGroup, YearCount[]>
  g1Subgroups: Record<string, YearCount[]>   // G1a/G1b/G1c
  retentionByGroup: Record<MainGroup, RetentionPoint[]>
  flowByGroup: Record<string, FlowSummary>   // G1/G2/G3 (G4 es terminal)
  projectionByGroup: Record<MainGroup, ProjectionPoint[]>
}

function rate(retained: number, base: number): number {
  return base > 0 ? Math.round((retained / base) * 1000) / 10 : 0
}

export function buildRetencionReport(rows: GroupAttRow[]): RetencionReport {
  const years = [...new Set(rows.map(r => r.yr))].sort((a, b) => a - b)

  // person → main group → set de años; y person → main group → edad máxima.
  const personGroupYears = new Map<string, Map<MainGroup, Set<number>>>()
  const personGroupMaxAge = new Map<string, Map<MainGroup, number>>()
  // Únicos por (grupo principal, año).
  const uniqMain = new Map<MainGroup, Map<number, Set<string>>>()
  // Para subgrupos de G1: subgrupo DOMINANTE de cada persona/año (el de mayor
  // edad alcanzada; desempate por visitas). Así cada persona-año cuenta en UN
  // solo subgrupo y la suma de G1a+G1b+G1c cuadra con el único consolidado de G1
  // (una persona que cruzó de subgrupo dentro del año no se cuenta dos veces).
  const g1Best = new Map<string, { grp: string; age: number; visits: number }>()

  for (const r of rows) {
    const mg = mainOf(r.grp)
    if (!mg) continue
    // índices por persona
    let gy = personGroupYears.get(r.person_id)
    if (!gy) { gy = new Map(); personGroupYears.set(r.person_id, gy) }
    let ys = gy.get(mg); if (!ys) { ys = new Set(); gy.set(mg, ys) }
    ys.add(r.yr)
    let ga = personGroupMaxAge.get(r.person_id)
    if (!ga) { ga = new Map(); personGroupMaxAge.set(r.person_id, ga) }
    ga.set(mg, Math.max(ga.get(mg) ?? 0, r.max_age))
    // únicos principales
    let um = uniqMain.get(mg); if (!um) { um = new Map(); uniqMain.set(mg, um) }
    let us = um.get(r.yr); if (!us) { us = new Set(); um.set(r.yr, us) }
    us.add(r.person_id)
    // subgrupo dominante de G1
    if (r.grp === 'G1a' || r.grp === 'G1b' || r.grp === 'G1c') {
      const k = `${r.person_id}|${r.yr}`
      const cur = g1Best.get(k)
      if (!cur || r.max_age > cur.age || (r.max_age === cur.age && r.visits > cur.visits)) {
        g1Best.set(k, { grp: r.grp, age: r.max_age, visits: r.visits })
      }
    }
  }

  const seriesOf = (m: Map<number, Set<string>> | undefined): YearCount[] =>
    years.map(y => ({ year: y, count: m?.get(y)?.size ?? 0 }))

  const uniquesByGroup = Object.fromEntries(
    MAIN_GROUPS.map(g => [g, seriesOf(uniqMain.get(g))]),
  ) as Record<MainGroup, YearCount[]>

  // Conteo de subgrupos G1 desde el dominante (cada persona-año en uno solo).
  const subCounts = new Map<string, Map<number, number>>()
  for (const [k, v] of g1Best) {
    const yr = Number(k.split('|')[1])
    let sm = subCounts.get(v.grp); if (!sm) { sm = new Map(); subCounts.set(v.grp, sm) }
    sm.set(yr, (sm.get(yr) ?? 0) + 1)
  }
  const g1Subgroups = Object.fromEntries(
    G1_SUBS.map(g => [g, years.map(y => ({ year: y, count: subCounts.get(g)?.get(y) ?? 0 }))]),
  ) as Record<string, YearCount[]>

  // ── Retención año a año: en (G, Y) y también en (G, Y+1) ──
  const retentionByGroup = Object.fromEntries(MAIN_GROUPS.map(g => {
    const um = uniqMain.get(g)
    const points: RetentionPoint[] = []
    for (let i = 0; i < years.length - 1; i++) {
      const y = years[i], y2 = years[i + 1]
      const setY = um?.get(y), setY2 = um?.get(y2)
      const base = setY?.size ?? 0
      let retained = 0
      if (setY && setY2) for (const p of setY) if (setY2.has(p)) retained++
      points.push({ fromYear: y, toYear: y2, base, retained, rate: rate(retained, base) })
    }
    return [g, points]
  })) as Record<MainGroup, RetentionPoint[]>

  // ── Flujo de transición (G1→G2, G2→G3, G3→G4) ──
  const lastYear = years[years.length - 1]
  const flowByGroup: Record<string, FlowSummary> = {}
  for (const g of ['G1', 'G2', 'G3'] as MainGroup[]) {
    const top = GROUP_TOP_AGE[g]
    const next = NEXT_GROUP[g]
    let siguen = 0, transicionaron = 0, perdidos = 0, dropout = 0, base = 0
    for (const [pid, gy] of personGroupYears) {
      const yearsInG = gy.get(g)
      if (!yearsInG || yearsInG.size === 0) continue
      base++
      const maxAge = personGroupMaxAge.get(pid)?.get(g) ?? 0
      const stillInG = yearsInG.has(lastYear)
      const inNext = (gy.get(next)?.size ?? 0) > 0
      if (stillInG) { siguen++; continue }
      if (maxAge >= top) { if (inNext) transicionaron++; else perdidos++ }
      else dropout++
    }
    flowByGroup[g] = { base, siguen, transicionaron, perdidos, dropout }
  }

  // ── Proyección 2025-2030: retención promedio de las últimas 3 transiciones,
  //    aplicada al último año real hacia adelante. Estimación simple. ──
  const PROJECT_TO = 2030
  const projectionByGroup = Object.fromEntries(MAIN_GROUPS.map(g => {
    const real = uniquesByGroup[g]
    const points: ProjectionPoint[] = real.map(p => ({ year: p.year, value: p.count, projected: false }))
    const rets = retentionByGroup[g].slice(-3).map(p => p.rate / 100).filter(r => r > 0)
    const avgRet = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0
    let last = real.length ? real[real.length - 1].count : 0
    for (let y = lastYear + 1; y <= PROJECT_TO; y++) {
      last = Math.round(last * avgRet)
      points.push({ year: y, value: last, projected: true })
    }
    return [g, points]
  })) as Record<MainGroup, ProjectionPoint[]>

  const totalRows = rows.length
  const coverageNote =
    `Clasificado por edad al asistir. Excluye check-ins de miembros sin fecha de nacimiento (~13%) y personas con una sola visita. ${totalRows.toLocaleString('es-CR')} registros persona-año-grupo.`

  return {
    years,
    coverageNote,
    uniquesByGroup,
    g1Subgroups,
    retentionByGroup,
    flowByGroup,
    projectionByGroup,
  }
}
