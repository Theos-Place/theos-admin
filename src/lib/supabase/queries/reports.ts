import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/types/database'
import { buildCharlaReport, type CharlaAggRow, type CharlaReport } from '@/lib/reports/charla-attendance'
import { buildGrowthReport, type GrowthAggRow, type GrowthReport } from '@/lib/reports/member-growth'
import { buildDiscipulosReport, type DmFlagRow, type DmMilestoneRow, type DiscipulosReport } from '@/lib/reports/discipulos'
import { buildRetencionReport, type GroupAttRow, type RetencionReport } from '@/lib/reports/retencion'
import {
  buildDirigentesReport, collapseAdminBuckets,
  type LeaderRow, type ActiveGroupRow, type PlanRow, type LeaderHistoryPoint,
  type DirigentesReport,
} from '@/lib/reports/dirigentes'
import {
  attendanceWindowStart, attendanceRecencyStart,
  ATTENDANCE_MONTHS, ATTENDANCE_RECENCY_DAYS, ATTENDANCE_MIN_CHARLAS,
  ACTIVE_ATTENDANCE_MONTHS, ACTIVE_ATTENDANCE_MIN,
} from '@/lib/attendance'

// Caché de reportes (tabla report_snapshots, refrescada por el cron nocturno
// /api/cron/report-snapshots). Dos estrategias según el peso del dataset:
//   · charla/growth: se cachean las filas AGREGADAS (pocas: ~3k) y se arma el
//     payload por request (barato, y permite filtrar por año/sede en memoria).
//   · discípulos/retención: la agregación cruda es enorme (23k / 17k filas), así
//     que el cron guarda el PAYLOAD YA CALCULADO (unos KB) y el request lo
//     devuelve casi directo. El filtrado por cohorte se hace en el cliente.

type AggRpc = 'report_charla_attendance' | 'report_member_growth'
type HeavyRpc = 'get_dm_flags' | 'get_dm_milestones' | 'get_group_attendance' | 'get_active_today'

// Keys en report_snapshots. Para charla/growth = nombre del RPC (filas). Para
// los pesados = payload final ya construido.
const KEY_DISCIPULOS = 'discipulos_payload'
const KEY_RETENCION = 'retencion_payload'
const KEY_DIRIGENTES = 'dirigentes_payload'

/** Trae TODAS las filas de un RPC paginando (.range corta en 1000). */
async function fetchAllRpc<T>(supabase: SupabaseClient, rpcName: AggRpc | HeavyRpc, params?: Record<string, unknown>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.rpc(rpcName, params).range(from, from + 999)
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
  // Ventana de "comprometido" anclada a HOY, con las constantes centrales
  // (mismos parámetros que active_attendance_member_ids: checked_in_at).
  const now = new Date()
  const params = {
    p_oldest: attendanceWindowStart(ATTENDANCE_MONTHS, now),
    p_recency: attendanceRecencyStart(ATTENDANCE_RECENCY_DAYS, now),
    p_min: ATTENDANCE_MIN_CHARLAS,
  }
  const [flags, milestones] = await Promise.all([
    fetchAllRpc<DmFlagRow>(supabase, 'get_dm_flags', params),
    fetchAllRpc<DmMilestoneRow>(supabase, 'get_dm_milestones', { p_min: ATTENDANCE_MIN_CHARLAS }),
  ])
  return buildDiscipulosReport(flags, milestones)
}
async function computeRetencion(supabase: SupabaseClient): Promise<RetencionReport> {
  // "Sigue asistiendo hoy" = criterio activo (≥2 charlas en 4 meses), anclado a HOY.
  const now = new Date()
  const [rows, active] = await Promise.all([
    fetchAllRpc<GroupAttRow>(supabase, 'get_group_attendance'),
    fetchAllRpc<{ member_id: string }>(supabase, 'get_active_today', {
      p_oldest: attendanceWindowStart(ACTIVE_ATTENDANCE_MONTHS, now),
      p_min: ACTIVE_ATTENDANCE_MIN,
    }),
  ])
  const activeToday = new Set(active.map(a => a.member_id))
  return buildRetencionReport(rows, activeToday)
}

/**
 * DIR-7 · Pulso de dirigentes. Tres consultas chicas (487 dirigentes, los grupos
 * abiertos y los planes): entra al snapshot por consistencia con el módulo, no
 * porque pese.
 *
 * La historia se lee de leader_report_history, que empezó a acumular el
 * 2026-08-21 — antes de eso el reporte muestra "sin dato" y no lo estima.
 */
async function computeDirigentes(supabase: SupabaseClient): Promise<DirigentesReport> {
  const [leaders, groups, plans, history] = await Promise.all([
    supabase.from('study_leaders')
      .select('member_id, is_active, availability_status, formation_study_codes, qualified_study_codes, zone_preference'),
    supabase.from('study_groups')
      .select('leader_id, co_leader_id').in('status', ['en_matricula', 'en_curso']),
    supabase.from('study_plans').select('code, name'),
    supabase.from('leader_report_history')
      .select('captured_on, activos, dando_ahora, disponibles_sin_grupo')
      .order('captured_on', { ascending: false }).limit(400),
  ])
  if (leaders.error) throw leaders.error
  if (groups.error) throw groups.error

  return buildDirigentesReport(
    (leaders.data ?? []) as unknown as LeaderRow[],
    (groups.data ?? []) as unknown as ActiveGroupRow[],
    ((plans.data ?? []) as Array<{ code: string | null; name: string | null }>)
      .filter((p): p is PlanRow => !!p.code && !!p.name),
    (history.data ?? []) as unknown as LeaderHistoryPoint[],
  )
}

/** Anota el punto de HOY en la historia. Upsert por día: si el cron corre dos
 *  veces, la segunda corrige la primera en vez de duplicar el día. */
async function appendLeaderHistory(supabase: SupabaseClient, r: DirigentesReport): Promise<void> {
  const { error } = await supabase.from('leader_report_history').upsert({
    captured_on: new Date().toISOString().slice(0, 10),
    activos: r.activos,
    dando_ahora: r.dando_ahora,
    disponibles_sin_grupo: r.disponibles_sin_grupo,
    en_pausa: r.en_pausa,
    en_revision: r.en_revision,
    total: r.total,
  })
  // Best-effort: perder un punto de la serie no puede tumbar el refresco de los
  // otros reportes.
  if (error) console.warn('appendLeaderHistory:', error.message)
}

/**
 * Reporte de dirigentes. `verMatiz` decide si el desglose de "en pausa" y "en
 * revisión" viaja o se colapsa a inactivos (DIR-6): el colapso ocurre acá, no en
 * la UI, para que el número no salga del servidor.
 */
export async function getDirigentesReport(verMatiz: boolean): Promise<DirigentesReport> {
  const supabase = createAdminClient()
  const full = (await readSnapshot<DirigentesReport>(supabase, KEY_DIRIGENTES))
    ?? await computeDirigentes(supabase)
  return verMatiz ? full : collapseAdminBuckets(full)
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

  // DIR-7: el snapshot del día Y su punto en la serie histórica.
  const dir = await computeDirigentes(supabase)
  await writeSnapshot(supabase, KEY_DIRIGENTES, dir, dir.total)
  await appendLeaderHistory(supabase, dir)
  counts[KEY_DIRIGENTES] = dir.total

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
