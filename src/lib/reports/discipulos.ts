// Cálculo del reporte "Discípulos Multiplicadores" (DM). Módulo PURO (sin React
// ni Supabase): toma las filas por-persona del RPC `get_dm_flags` y el agregado
// de `get_dm_milestones`, y arma el payload de la card. Se ejecuta server-side.
//
// Definiciones (ver migración 20260721030000):
//   · comprometido = ≥6 charlas en 6 meses + 1 en los últimos 60 días
//   · sirve        = volunteers activo
//   · dona         = members.is_donor
//   · DM           = los 3 a la vez

/** Fila cruda de get_dm_flags (una por persona no-sistema). */
export type DmFlagRow = {
  person_id: string
  es_comprometido: boolean
  sirve: boolean
  dona: boolean
  es_dm: boolean
  cohort_year: number | null
}

/** Fila cruda de get_dm_milestones (una por hito). */
export type DmMilestoneRow = { milestone: string; avg_days: number; n: number }

export type CriteriaStat = { n: number; pct: number }
/** Las 7 regiones del diagrama de Venn de 3 conjuntos. */
export type VennRegions = {
  soloComprometido: number
  soloSirve: number
  soloDona: number
  comprometidoSirve: number   // C∩S sin D
  comprometidoDona: number    // C∩D sin S
  sirveDona: number           // S∩D sin C
  losTres: number             // C∩S∩D = DM
}
export type MilestonePoint = { key: string; label: string; avgDays: number; n: number }
export type CohortRow = {
  year: number
  nuevos: number       // primera charla ese año
  dmHoy: number        // de esos, cuántos son DM hoy
  comprometidos: number
  sirven: number
  donan: number
}

export type DiscipulosReport = {
  total: number                 // base: personas no-sistema
  dm: number
  criteria: { comprometidos: CriteriaStat; sirven: CriteriaStat; donan: CriteriaStat }
  venn: VennRegions
  milestones: MilestonePoint[]
  cohortYears: number[]         // años con nuevos (desc)
  cohortYear: number            // seleccionado
  cohort: CohortRow | null      // detalle del año seleccionado
  cohortTable: CohortRow[]      // todos los años (desc) para la mini tabla
}

const MILESTONE_LABELS: Record<string, string> = {
  comprometido: 'Primera asistencia comprometida',
  nivel1: 'Completar Nivel 1',
  servicio: 'Primer registro en servicio',
  donacion: 'Primera donación',
}
const MILESTONE_ORDER = ['comprometido', 'nivel1', 'servicio', 'donacion']

function pct(n: number, base: number): number {
  return base > 0 ? Math.round((n / base) * 1000) / 10 : 0
}

/** Arma el payload del reporte para un año de cohorte seleccionado. */
export function buildDiscipulosReport(
  flags: DmFlagRow[],
  milestones: DmMilestoneRow[],
  opts: { cohortYear?: number } = {},
): DiscipulosReport {
  const total = flags.length
  const dm = flags.filter(f => f.es_dm).length

  const nC = flags.filter(f => f.es_comprometido).length
  const nS = flags.filter(f => f.sirve).length
  const nD = flags.filter(f => f.dona).length

  // Venn: 7 regiones exclusivas.
  const venn: VennRegions = {
    soloComprometido: flags.filter(f => f.es_comprometido && !f.sirve && !f.dona).length,
    soloSirve: flags.filter(f => !f.es_comprometido && f.sirve && !f.dona).length,
    soloDona: flags.filter(f => !f.es_comprometido && !f.sirve && f.dona).length,
    comprometidoSirve: flags.filter(f => f.es_comprometido && f.sirve && !f.dona).length,
    comprometidoDona: flags.filter(f => f.es_comprometido && !f.sirve && f.dona).length,
    sirveDona: flags.filter(f => !f.es_comprometido && f.sirve && f.dona).length,
    losTres: flags.filter(f => f.es_comprometido && f.sirve && f.dona).length,
  }

  const milestonePoints: MilestonePoint[] = MILESTONE_ORDER
    .map(key => {
      const row = milestones.find(m => m.milestone === key)
      return row ? { key, label: MILESTONE_LABELS[key] ?? key, avgDays: Math.round(row.avg_days), n: row.n } : null
    })
    .filter((m): m is MilestonePoint => m != null && m.avgDays >= 0)

  // Cohortes: por año de primera charla.
  const byYear = new Map<number, DmFlagRow[]>()
  for (const f of flags) {
    if (f.cohort_year == null) continue
    const arr = byYear.get(f.cohort_year) ?? []
    arr.push(f)
    byYear.set(f.cohort_year, arr)
  }
  const cohortRows: CohortRow[] = [...byYear.entries()]
    .map(([year, rows]) => ({
      year,
      nuevos: rows.length,
      dmHoy: rows.filter(r => r.es_dm).length,
      comprometidos: rows.filter(r => r.es_comprometido).length,
      sirven: rows.filter(r => r.sirve).length,
      donan: rows.filter(r => r.dona).length,
    }))
    .sort((a, b) => b.year - a.year)

  const cohortYears = cohortRows.map(r => r.year)
  const cohortYear = opts.cohortYear && cohortYears.includes(opts.cohortYear)
    ? opts.cohortYear
    : (cohortYears[0] ?? new Date().getFullYear())
  const cohort = cohortRows.find(r => r.year === cohortYear) ?? null

  return {
    total,
    dm,
    criteria: {
      comprometidos: { n: nC, pct: pct(nC, total) },
      sirven: { n: nS, pct: pct(nS, total) },
      donan: { n: nD, pct: pct(nD, total) },
    },
    venn,
    milestones: milestonePoints,
    cohortYears,
    cohortYear,
    cohort,
    cohortTable: cohortRows,
  }
}
