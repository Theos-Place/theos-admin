// Cálculo del reporte "Control de Asistencia por Grupo/Sede" a partir del
// agregado compacto del RPC `report_charla_attendance` (yr, title, wk, mo,
// checkins). Módulo PURO (sin React, sin Supabase): la sede se deriva del
// título con el diccionario canónico. Se ejecuta server-side (API), nunca trae
// check-ins crudos al cliente.

import { canonicalCharlaTitle } from '@/lib/sedes-canonical'

/** Fila cruda del RPC. `calidad` = 'asistente' | 'servidor' (migración
 *  20260910090000). Opcional: los snapshots viejos no la traen y para el
 *  reporte anual da igual — solo suma checkins. */
export type CharlaAggRow = {
  /** Año CALENDARIO del check-in: manda en los totales del año y en el mes. */
  yr: number
  /**
   * Año al que pertenece la SEMANA, que no siempre es el del día: el 3 de enero
   * de 2021 cae en la semana 53 de 2020. La serie semanal va por acá o el
   * número de semana no cierra — 2021 no tiene semana 53.
   */
  iso_yr: number
  title: string; wk: number; mo: number; checkins: number
  calidad?: string | null
}

export type AnnualCard = {
  year: number
  total: number
  weeks: number
  weeklyAvg: number
  /** % de cambio del promedio semanal vs el año anterior (null si no hay base). */
  changePct: number | null
}
/** `partial` = semana atípicamente baja (feriado / pocos días con charlas):
 *  total < 50% de la mediana del año. Se marca para no leerla como caída real. */
export type WeeklyPoint = { week: number; total: number; partial: boolean }
export type SedeRank = { sede: string; total: number }
/** Promedio semanal de cada mes (Ene–Dic) por año. `values[year]` = null si sin datos. */
export type MonthlyPoint = { month: number; values: Record<number, number | null> }

export type CharlaReport = {
  years: number[]          // años con datos (desc)
  sedes: string[]          // sedes con datos (alfabético)
  year: number             // año seleccionado
  sede: string             // sede seleccionada o 'all'
  annualCards: AnnualCard[]
  weekly: WeeklyPoint[]
  weeklyAvg: number        // línea de promedio del año seleccionado (sede filtrada)
  sedeRanking: SedeRank[]  // todas las sedes del año seleccionado (para comparar)
  monthlyYears: number[]   // últimos 3 años hasta el seleccionado
  monthly: MonthlyPoint[]
}

export const ALL_SEDES = 'all'

/** Etiqueta de sede a partir del título de la charla: nombre canónico sin el
 *  prefijo "Charla "; si el título no está en el diccionario, se usa tal cual
 *  (no se descarta — así no se pierde asistencia, p. ej. "United Youth"). */
export function sedeFromTitle(title: string): string {
  const canon = canonicalCharlaTitle(title) ?? title
  return canon.replace(/^Charla\s+/i, '').trim() || title
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Construye el payload del reporte para (año, sede) desde las filas agregadas. */
export function buildCharlaReport(
  rawRows: CharlaAggRow[],
  opts: { year?: number; sede?: string; today?: Date } = {},
): CharlaReport {
  const rows = rawRows.map(r => ({ ...r, sede: sedeFromTitle(r.title) }))

  const years = Array.from(new Set(rows.map(r => r.yr))).sort((a, b) => b - a)
  const sedes = Array.from(new Set(rows.map(r => r.sede))).sort((a, b) => a.localeCompare(b))

  const year = opts.year && years.includes(opts.year) ? opts.year : (years[0] ?? new Date().getFullYear())
  const sede = opts.sede && opts.sede !== ALL_SEDES && sedes.includes(opts.sede) ? opts.sede : ALL_SEDES

  const bySede = (r: { sede: string }) => sede === ALL_SEDES || r.sede === sede
  const filtered = rows.filter(bySede)

  // ── Promedio anual (cards) — respeta el filtro de sede ──
  // El TOTAL del año es calendario ("la asistencia de 2026" es enero a
  // diciembre), pero el promedio semanal se calcula sobre el año ISO: dividir
  // check-ins de un año entre semanas de otro da un número que no significa
  // nada. La diferencia entre las dos ventanas es de 13 check-ins en toda la
  // historia, así que las cards no se mueven; lo que se gana es que la cuenta
  // sea defendible.
  const totalByYear = new Map<number, number>()
  for (const r of filtered) totalByYear.set(r.yr, (totalByYear.get(r.yr) ?? 0) + r.checkins)

  const isoByYear = new Map<number, { total: number; weeks: Set<number> }>()
  for (const r of filtered) {
    const e = isoByYear.get(r.iso_yr) ?? { total: 0, weeks: new Set<number>() }
    e.total += r.checkins
    if (r.checkins > 0) e.weeks.add(r.wk)
    isoByYear.set(r.iso_yr, e)
  }
  const weeklyAvgOf = (y: number): number => {
    const e = isoByYear.get(y)
    if (!e || e.weeks.size === 0) return 0
    return e.total / e.weeks.size
  }
  // Cards en orden ascendente para calcular el cambio vs año previo; se muestran desc.
  const yearsAsc = [...years].sort((a, b) => a - b)
  const annualCards: AnnualCard[] = yearsAsc.map(y => {
    const total = totalByYear.get(y) ?? 0
    const weeks = isoByYear.get(y)?.weeks.size ?? 0
    const avg = weeklyAvgOf(y)
    const prevAvg = weeklyAvgOf(y - 1)
    const changePct = prevAvg > 0 ? round1(((avg - prevAvg) / prevAvg) * 100) : null
    return { year: y, total, weeks, weeklyAvg: round1(avg), changePct }
  }).reverse()

  // ── Asistencia semanal (año seleccionado, sede filtrada) ──
  const weekTotals = new Map<number, number>()
  // Por iso_yr: una semana pertenece al año de la SEMANA, no al del día. Con
  // r.yr, los check-ins del 3-ene-2021 salían como "semana 53 de 2021".
  for (const r of filtered) if (r.iso_yr === year) weekTotals.set(r.wk, (weekTotals.get(r.wk) ?? 0) + r.checkins)
  const weekly: WeeklyPoint[] = []
  if (weekTotals.size > 0) {
    const wks = [...weekTotals.keys()]
    const min = Math.min(...wks), max = Math.max(...wks)
    // Mediana de las semanas CON datos → umbral de "semana parcial" (50%).
    const present = [...weekTotals.values()].filter(v => v > 0).sort((a, b) => a - b)
    const median = present.length ? present[Math.floor(present.length / 2)] : 0
    const partialThreshold = median * 0.5
    for (let w = min; w <= max; w++) {
      const total = weekTotals.get(w) ?? 0
      weekly.push({ week: w, total, partial: median > 0 && total > 0 && total < partialThreshold })
    }
  }
  const weeklyAvg = round1(weeklyAvgOf(year))

  // ── Comparación por sede (año seleccionado, TODAS las sedes para comparar) ──
  const sedeTotals = new Map<string, number>()
  for (const r of rows) if (r.yr === year) sedeTotals.set(r.sede, (sedeTotals.get(r.sede) ?? 0) + r.checkins)
  const sedeRanking: SedeRank[] = [...sedeTotals.entries()]
    .map(([s, total]) => ({ sede: s, total }))
    .sort((a, b) => b.total - a.total)

  // ── Comparativo por año y mes (últimos 3 años, promedio semanal mensual, sede filtrada) ──
  const monthlyYears = [year - 2, year - 1, year].filter(y => years.includes(y))
  const monthAgg = new Map<string, { total: number; weeks: Set<number> }>() // key `${y}-${mo}`
  for (const r of filtered) {
    if (!monthlyYears.includes(r.yr)) continue
    const k = `${r.yr}-${r.mo}`
    const e = monthAgg.get(k) ?? { total: 0, weeks: new Set<number>() }
    e.total += r.checkins
    if (r.checkins > 0) e.weeks.add(r.wk)
    monthAgg.set(k, e)
  }
  // Año en curso: no exponer meses futuros (sin datos reales) aunque hubiera
  // filas mal fechadas; los años completos sí se muestran enteros.
  const now = opts.today ?? new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1
  const monthly: MonthlyPoint[] = []
  for (let mo = 1; mo <= 12; mo++) {
    const values: Record<number, number | null> = {}
    for (const y of monthlyYears) {
      if (y === curYear && mo > curMonth) { values[y] = null; continue }
      const e = monthAgg.get(`${y}-${mo}`)
      values[y] = e && e.weeks.size > 0 ? round1(e.total / e.weeks.size) : null
    }
    monthly.push({ month: mo, values })
  }

  return { years, sedes, year, sede, annualCards, weekly, weeklyAvg, sedeRanking, monthlyYears, monthly }
}
