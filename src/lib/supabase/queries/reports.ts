import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/types/database'
import { buildCharlaReport, sedeFromTitle, type CharlaAggRow, type CharlaReport } from '@/lib/reports/charla-attendance'
import { buildGrowthReport, type GrowthAggRow, type GrowthReport } from '@/lib/reports/member-growth'
import { buildDiscipulosReport, type DmFlagRow, type DmMilestoneRow, type DiscipulosReport } from '@/lib/reports/discipulos'
import { buildRetencionReport, type GroupAttRow, type RetencionReport } from '@/lib/reports/retencion'
import { detalleDeSemana, type DetalleDeSemana } from '@/lib/reports/semana-detalle'
import {
  buildDirigentesReport, collapseAdminBuckets,
  type LeaderRow, type ActiveGroupRow, type PlanRow, type LeaderHistoryPoint,
  type DirigentesReport,
} from '@/lib/reports/dirigentes'
import type { AsistenteDeLaSemana } from '@/lib/reports/abandonos'
import type { PersonaNueva, Canal, FilaDeSerie } from '@/lib/reports/personas-nuevas'
import type { FilaCruda as FilaCrudaDemografia } from '@/lib/reports/demografia'
import type { FilaDeEstudios } from '@/lib/reports/estudios'
import {
  attendanceWindowStart, attendanceRecencyStart,
  ATTENDANCE_MONTHS, ATTENDANCE_RECENCY_DAYS, ATTENDANCE_MIN_CHARLAS,
  ACTIVE_ATTENDANCE_MONTHS, ACTIVE_ATTENDANCE_MIN,
} from '@/lib/attendance'

/**
 * Trae TODAS las filas de un RPC, no las primeras 1.000.
 *
 * PostgREST corta en `db-max-rows` (1.000) y no avisa. Costó dos veces el mismo
 * día (2026-09-21): la demografía de un año son 7.135 filas y llegaban 1.000, o
 * sea 849 personas en vez de 4.355. Un reporte que devuelve exactamente 1.000
 * de algo casi siempre está truncado.
 */
const TOPE_POSTGREST = 1000

async function todasLasFilas<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let desde = 0; ; desde += TOPE_POSTGREST) {
    const { data, error } = await pedir(desde, desde + TOPE_POSTGREST - 1)
    if (error) throw error
    const lote = (data ?? []) as T[]
    out.push(...lote)
    if (lote.length < TOPE_POSTGREST) break
  }
  return out
}

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

/**
 * REP-2 · El detalle de UNA semana, del MISMO snapshot que el reporte anual.
 *
 * Sobre el snapshot y no contra event_checkins: son 170 mil filas y el patrón
 * del módulo es leer el agregado nocturno. Un clic en una barra no puede
 * disparar un conteo en vivo sobre esa tabla.
 */
export async function getSemanaDetalle(
  year: number, week: number, opts: { sede?: string } = {},
): Promise<DetalleDeSemana | null> {
  const supabase = createAdminClient()
  const filas = await loadAggRows<CharlaAggRow>(supabase, 'report_charla_attendance')
  return detalleDeSemana(filas, year, week, { sede: opts.sede })
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

/**
 * REP-5 · Los asistentes de una semana, con la fecha en que volvieron.
 *
 * Una consulta para las DOS listas: los abandonos se derivan de estas mismas
 * filas en `lib/reports/abandonos.ts`, comparando `regreso` contra el cierre de
 * la ventana. Traer los check-ins al cliente para filtrarlos serían 168k filas.
 */
export async function getAsistentesDeLaSemana(
  desde: string,
  hasta: string,
): Promise<AsistenteDeLaSemana[]> {
  const supabase = createAdminClient()
  const filas = await todasLasFilas<{
    member_id: string; nombre: string; telefono: string | null
    email: string | null; sedes: string[] | null; regreso: string | null; visitas: number | null
  }>((d: number, h: number) => supabase.rpc('report_asistentes_de_la_semana', { p_desde: desde, p_hasta: hasta })
    .order('member_id').range(d, h))
  return (filas as Array<{
    member_id: string; nombre: string; telefono: string | null
    email: string | null; sedes: string[] | null; regreso: string | null; visitas: number | null
  }>).map(r => ({
    member_id: r.member_id,
    nombre: r.nombre,
    telefono: r.telefono,
    email: r.email,
    // La sede sale del título con la MISMA función que el resto del reporte.
    sedes: (r.sedes ?? []).map(sedeFromTitle),
    regreso: r.regreso,
    visitas: Number(r.visitas ?? 0),
  }))
}

/** REP-6 · La serie mensual de personas nuevas (para los dos gráficos). */
export async function getSeriePersonasNuevas(): Promise<FilaDeSerie[]> {
  const supabase = createAdminClient()
  const filas = await todasLasFilas<{ anio: number; mes: number; canal: string; origen: string | null; n: number }>(
    (d, h) => supabase.rpc('report_personas_nuevas_series').order('anio').range(d, h),
  )
  return filas.map(f => ({ ...f, n: Number(f.n) }))
}

/** REP-6 · El detalle de las personas nuevas de un período. */
export async function getPersonasNuevas(desde: string, hasta: string): Promise<PersonaNueva[]> {
  const supabase = createAdminClient()
  const filas = await todasLasFilas<{
    member_id: string; nombre: string; birth_date: string | null; phone: string | null
    fecha: string; canal: string; origen: string | null
    volvio: boolean; se_matriculo: boolean; es_servidor: boolean
  }>((d: number, h: number) => supabase.rpc('report_personas_nuevas', { p_desde: desde, p_hasta: hasta })
    .order('member_id').range(d, h))
  return (filas as Array<{
    member_id: string; nombre: string; birth_date: string | null; phone: string | null
    fecha: string; canal: string; origen: string | null
    volvio: boolean; se_matriculo: boolean; es_servidor: boolean
  }>).map(r => ({
    member_id: r.member_id,
    nombre: r.nombre,
    birth_date: r.birth_date,
    phone: r.phone,
    fecha: r.fecha,
    canal: (r.canal === 'estudio' || r.canal === 'evento' ? r.canal : 'charla') as Canal,
    origen: r.origen ?? '',
    volvio: r.volvio,
    seMatriculo: r.se_matriculo,
    esServidor: r.es_servidor,
  }))
}

/** REP-8 · Quiénes asistieron en un rango, por sede, con edad y género. */
export async function getDemografiaPorSede(desde: string, hasta: string): Promise<FilaCrudaDemografia[]> {
  const supabase = createAdminClient()
  const filas = await todasLasFilas<{ title: string; member_id: string; birth_date: string | null; gender: string | null }>(
    (d: number, h: number) => supabase.rpc('report_demografia_por_sede', { p_desde: desde, p_hasta: hasta })
      .order('member_id').range(d, h),
  )
  return filas.map(r => ({ sede: sedeFromTitle(r.title), member_id: r.member_id, birth_date: r.birth_date, gender: r.gender }))
}

/** REP-9 · Una fila por (plan, persona) de los estudios en curso en un año. */
export async function getEstudiosDelAnio(anio: number): Promise<FilaDeEstudios[]> {
  const supabase = createAdminClient()
  return todasLasFilas<FilaDeEstudios>(
    (d, h) => supabase.rpc('report_estudios_del_anio', { p_anio: anio }).order('member_id').range(d, h),
  )
}

/** REP-9 · Estudiantes por año y por plan, para la evolución. */
export async function getSerieDeEstudios(): Promise<Array<{ anio: number; plan_code: string; plan_nombre: string; estudiantes: number }>> {
  const supabase = createAdminClient()
  const filas = await todasLasFilas<{ anio: number; plan_code: string; plan_nombre: string; estudiantes: number }>(
    (d, h) => supabase.rpc('report_estudios_series').order('anio').range(d, h),
  )
  return filas.map(f => ({ ...f, estudiantes: Number(f.estudiantes) }))
}
