import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/types/database'
import { buildCharlaReport, type CharlaAggRow, type CharlaReport } from '@/lib/reports/charla-attendance'
import { buildGrowthReport, type GrowthAggRow, type GrowthReport } from '@/lib/reports/member-growth'
import { buildDiscipulosReport, type DmFlagRow, type DmMilestoneRow, type DiscipulosReport } from '@/lib/reports/discipulos'
import { buildRetencionReport, type GroupAttRow, type RetencionReport } from '@/lib/reports/retencion'

// RPCs pesadas de reportes. Sus resultados se cachean en la tabla
// report_snapshots (refrescada por el cron /api/cron/report-snapshots), así las
// páginas no re-agregan sobre 160k+ check-ins en cada carga. `report_key` de la
// caché = nombre del RPC.
type ReportRpc =
  | 'report_charla_attendance'
  | 'report_member_growth'
  | 'get_dm_flags'
  | 'get_dm_milestones'
  | 'get_group_attendance'

/** Trae TODAS las filas de un RPC paginando (.range corta en 1000). */
async function fetchAllRpc<T>(supabase: SupabaseClient, rpcName: ReportRpc): Promise<T[]> {
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

/** Lee el dataset cacheado; si no hay snapshot todavía (primera vez, o cron aún
 *  no corrió), cae al RPC en vivo para no romper. */
async function loadDataset<T>(supabase: SupabaseClient, rpcName: ReportRpc): Promise<T[]> {
  const { data, error } = await supabase
    .from('report_snapshots')
    .select('data')
    .eq('report_key', rpcName)
    .maybeSingle()
  if (!error && data?.data) return data.data as T[]
  return fetchAllRpc<T>(supabase, rpcName)
}

/** Refresca la caché de todos los datasets de reportes. La usa el cron nocturno.
 *  Devuelve el conteo de filas por dataset (para logging/healthcheck). */
export async function refreshReportSnapshots(): Promise<Record<ReportRpc, number>> {
  const supabase = createAdminClient()
  const keys: ReportRpc[] = [
    'report_charla_attendance', 'report_member_growth',
    'get_dm_flags', 'get_dm_milestones', 'get_group_attendance',
  ]
  const counts = {} as Record<ReportRpc, number>
  for (const key of keys) {
    const rows = await fetchAllRpc<unknown>(supabase, key)
    const { error } = await supabase
      .from('report_snapshots')
      .upsert({ report_key: key, data: rows as unknown as Json, row_count: rows.length, updated_at: new Date().toISOString() })
    if (error) throw new Error(`upsert ${key}: ${error.message}`)
    counts[key] = rows.length
  }
  return counts
}

/** Reporte de Control de Asistencia por sede. Lee el agregado compacto cacheado
 *  y calcula las series para (año, sede) server-side. */
export async function getCharlaAttendanceReport(opts: { year?: number; sede?: string } = {}): Promise<CharlaReport> {
  const supabase = createAdminClient()
  const rows = await loadDataset<CharlaAggRow>(supabase, 'report_charla_attendance')
  return buildCharlaReport(rows, opts)
}

/** Reporte de Crecimiento (personas nuevas). Lee el agregado cacheado y calcula
 *  las series para (año, sede). */
export async function getMemberGrowthReport(opts: { year?: number; sede?: string } = {}): Promise<GrowthReport> {
  const supabase = createAdminClient()
  const rows = await loadDataset<GrowthAggRow>(supabase, 'report_member_growth')
  return buildGrowthReport(rows, opts)
}

/** Reporte de Discípulos Multiplicadores. Lee los flags por-persona y los hitos
 *  cacheados, y arma el payload para el año de cohorte seleccionado. */
export async function getDiscipulosReport(opts: { cohortYear?: number } = {}): Promise<DiscipulosReport> {
  const supabase = createAdminClient()
  const [flags, milestones] = await Promise.all([
    loadDataset<DmFlagRow>(supabase, 'get_dm_flags'),
    loadDataset<DmMilestoneRow>(supabase, 'get_dm_milestones'),
  ])
  return buildDiscipulosReport(flags, milestones, opts)
}

/** Reporte de Retención y Transición. Lee las filas por persona/año/grupo
 *  cacheadas y arma únicos, retención, flujo y proyección. */
export async function getRetencionReport(): Promise<RetencionReport> {
  const supabase = createAdminClient()
  const rows = await loadDataset<GroupAttRow>(supabase, 'get_group_attendance')
  return buildRetencionReport(rows)
}
