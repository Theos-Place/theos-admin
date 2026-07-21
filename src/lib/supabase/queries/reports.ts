import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/types/database'
import { buildCharlaReport, type CharlaAggRow, type CharlaReport } from '@/lib/reports/charla-attendance'
import { buildGrowthReport, type GrowthAggRow, type GrowthReport } from '@/lib/reports/member-growth'
import { buildDiscipulosReport, type DmFlagRow, type DmMilestoneRow, type DiscipulosReport } from '@/lib/reports/discipulos'
import { buildRetencionReport, type GroupAttRow, type RetencionReport } from '@/lib/reports/retencion'

// Caché de reportes (tabla report_snapshots, refrescada por el cron nocturno
// /api/cron/report-snapshots). Dos estrategias según el peso del dataset:
//   · charla/growth: se cachean las filas AGREGADAS (pocas: ~3k) y se arma el
//     payload por request (barato, y permite filtrar por año/sede en memoria).
//   · discípulos/retención: la agregación cruda es enorme (23k / 17k filas), así
//     que el cron guarda el PAYLOAD YA CALCULADO (unos KB) y el request lo
//     devuelve casi directo. El filtrado por cohorte se hace en el cliente.

type AggRpc = 'report_charla_attendance' | 'report_member_growth'
type HeavyRpc = 'get_dm_flags' | 'get_dm_milestones' | 'get_group_attendance'

// Keys en report_snapshots. Para charla/growth = nombre del RPC (filas). Para
// los pesados = payload final ya construido.
const KEY_DISCIPULOS = 'discipulos_payload'
const KEY_RETENCION = 'retencion_payload'

/** Trae TODAS las filas de un RPC paginando (.range corta en 1000). */
async function fetchAllRpc<T>(supabase: SupabaseClient, rpcName: AggRpc | HeavyRpc): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.rpc(rpcName).range(from, from + 999)
    if (error) throw error
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < 1000) break
  }
  return rows
}

async function readSnapshot<T>(supabase: SupabaseClient, key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('report_snapshots').select('data').eq('report_key', key).maybeSingle()
  if (error || !data?.data) return null
  return data.data as T
}

async function writeSnapshot(supabase: SupabaseClient, key: string, value: unknown, rowCount: number): Promise<void> {
  const { error } = await supabase.from('report_snapshots').upsert({
    report_key: key, data: value as unknown as Json, row_count: rowCount, updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`upsert ${key}: ${error.message}`)
}

/** Filas agregadas cacheadas (charla/growth); fallback al RPC en vivo. */
async function loadAggRows<T>(supabase: SupabaseClient, rpcName: AggRpc): Promise<T[]> {
  const cached = await readSnapshot<T[]>(supabase, rpcName)
  if (cached) return cached
  return fetchAllRpc<T>(supabase, rpcName)
}

// ── Cómputo en vivo de los reportes pesados (lo usa el cron) ──
async function computeDiscipulos(supabase: SupabaseClient): Promise<DiscipulosReport> {
  const [flags, milestones] = await Promise.all([
    fetchAllRpc<DmFlagRow>(supabase, 'get_dm_flags'),
    fetchAllRpc<DmMilestoneRow>(supabase, 'get_dm_milestones'),
  ])
  return buildDiscipulosReport(flags, milestones)
}
async function computeRetencion(supabase: SupabaseClient): Promise<RetencionReport> {
  const rows = await fetchAllRpc<GroupAttRow>(supabase, 'get_group_attendance')
  return buildRetencionReport(rows)
}

/** Refresca toda la caché de reportes. La usa el cron nocturno. */
export async function refreshReportSnapshots(): Promise<Record<string, number>> {
  const supabase = createAdminClient()
  const counts: Record<string, number> = {}

  for (const rpc of ['report_charla_attendance', 'report_member_growth'] as AggRpc[]) {
    const rows = await fetchAllRpc<unknown>(supabase, rpc)
    await writeSnapshot(supabase, rpc, rows, rows.length)
    counts[rpc] = rows.length
  }
  const disc = await computeDiscipulos(supabase)
  await writeSnapshot(supabase, KEY_DISCIPULOS, disc, disc.total)
  counts[KEY_DISCIPULOS] = disc.total

  const ret = await computeRetencion(supabase)
  await writeSnapshot(supabase, KEY_RETENCION, ret, ret.years.length)
  counts[KEY_RETENCION] = ret.years.length

  return counts
}

/** Control de Asistencia por sede: filas agregadas cacheadas → series (año, sede). */
export async function getCharlaAttendanceReport(opts: { year?: number; sede?: string } = {}): Promise<CharlaReport> {
  const supabase = createAdminClient()
  return buildCharlaReport(await loadAggRows<CharlaAggRow>(supabase, 'report_charla_attendance'), opts)
}

/** Crecimiento (personas nuevas): filas agregadas cacheadas → series (año, sede). */
export async function getMemberGrowthReport(opts: { year?: number; sede?: string } = {}): Promise<GrowthReport> {
  const supabase = createAdminClient()
  return buildGrowthReport(await loadAggRows<GrowthAggRow>(supabase, 'report_member_growth'), opts)
}

/** Discípulos Multiplicadores: payload final cacheado (fallback a cómputo en
 *  vivo la primera vez). El filtro de cohorte lo hace el cliente sobre el payload. */
export async function getDiscipulosReport(): Promise<DiscipulosReport> {
  const supabase = createAdminClient()
  return (await readSnapshot<DiscipulosReport>(supabase, KEY_DISCIPULOS)) ?? computeDiscipulos(supabase)
}

/** Retención y Transición: payload final cacheado (fallback a cómputo en vivo). */
export async function getRetencionReport(): Promise<RetencionReport> {
  const supabase = createAdminClient()
  return (await readSnapshot<RetencionReport>(supabase, KEY_RETENCION)) ?? computeRetencion(supabase)
}
