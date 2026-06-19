// Cálculo del reporte de "Crecimiento" (personas nuevas / crecimiento BRUTO) a
// partir del agregado compacto del RPC `report_member_growth` (created_yr,
// created_mo, title, new_members). Módulo PURO (sin React, sin Supabase): la
// sede se deriva del título con el mismo diccionario canónico que asistencia.
//
// "Nuevo" = fecha de creación del perfil (members.created_at). La sede es la
// DOMINANTE por asistencia a charlas (la sede a la que más asistió). Si nunca
// asistió, cae en "Sin sede". Crecimiento BRUTO: solo altas, sin restar bajas.

import { sedeFromTitle, ALL_SEDES } from '@/lib/reports/charla-attendance'

/** Etiqueta para miembros sin asistencia a charlas (sin sede atribuible). */
export const NO_SEDE = 'Sin sede'

/** Fila cruda del RPC. `title` null = el miembro no asistió a ninguna charla. */
export type GrowthAggRow = { created_yr: number; created_mo: number; title: string | null; new_members: number }

export type GrowthBySede = { sede: string; total: number }
export type GrowthMonth = { month: number; total: number }

export type GrowthReport = {
  years: number[]            // años con registros (desc)
  year: number               // año seleccionado
  sede: string               // sede seleccionada o 'all'
  totalNew: number           // nuevos del año seleccionado (respeta filtro de sede)
  prevTotal: number          // nuevos del año anterior (mismo filtro)
  changePct: number | null   // % vs año anterior (null si no hay base)
  bySede: GrowthBySede[]     // nuevos por sede en el año (TODAS las sedes, para comparar)
  monthly: GrowthMonth[]     // nuevos por mes del año (respeta filtro de sede)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Construye el payload del reporte de crecimiento para (año, sede). */
export function buildGrowthReport(
  rawRows: GrowthAggRow[],
  opts: { year?: number; sede?: string } = {},
): GrowthReport {
  // Mapea cada fila a su sede canónica ("Sin sede" si no asistió a charlas).
  const rows = rawRows.map(r => ({
    yr: r.created_yr,
    mo: r.created_mo,
    sede: r.title ? sedeFromTitle(r.title) : NO_SEDE,
    n: r.new_members,
  }))

  const years = Array.from(new Set(rows.map(r => r.yr))).sort((a, b) => b - a)
  const year = opts.year && years.includes(opts.year) ? opts.year : (years[0] ?? new Date().getFullYear())
  // "Sin sede" no es una sede seleccionable (no está en el dropdown de sedes).
  const sede = opts.sede && opts.sede !== ALL_SEDES ? opts.sede : ALL_SEDES

  const bySedeMatch = (r: { sede: string }) => sede === ALL_SEDES || r.sede === sede

  // ── Total del año (y año previo) respetando el filtro de sede ──
  const totalOfYear = (y: number) =>
    rows.filter(r => r.yr === y && bySedeMatch(r)).reduce((s, r) => s + r.n, 0)
  const totalNew = totalOfYear(year)
  const prevTotal = totalOfYear(year - 1)
  const changePct = prevTotal > 0 ? round1(((totalNew - prevTotal) / prevTotal) * 100) : null

  // ── Nuevos por sede (año seleccionado, TODAS las sedes para comparar) ──
  const sedeTotals = new Map<string, number>()
  for (const r of rows) if (r.yr === year) sedeTotals.set(r.sede, (sedeTotals.get(r.sede) ?? 0) + r.n)
  const bySede: GrowthBySede[] = [...sedeTotals.entries()]
    .map(([s, total]) => ({ sede: s, total }))
    .sort((a, b) => b.total - a.total)

  // ── Nuevos por mes (año seleccionado, respeta filtro de sede) ──
  const monthTotals = new Map<number, number>()
  for (const r of rows) if (r.yr === year && bySedeMatch(r)) monthTotals.set(r.mo, (monthTotals.get(r.mo) ?? 0) + r.n)
  const monthly: GrowthMonth[] = []
  for (let mo = 1; mo <= 12; mo++) monthly.push({ month: mo, total: monthTotals.get(mo) ?? 0 })

  return { years, year, sede, totalNew, prevTotal, changePct, bySede, monthly }
}
