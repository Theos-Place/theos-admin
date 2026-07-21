import { createAdminClient } from '@/lib/supabase/admin'
import { buildCharlaReport, type CharlaAggRow, type CharlaReport } from '@/lib/reports/charla-attendance'
import { buildGrowthReport, type GrowthAggRow, type GrowthReport } from '@/lib/reports/member-growth'
import { buildDiscipulosReport, type DmFlagRow, type DmMilestoneRow, type DiscipulosReport } from '@/lib/reports/discipulos'

/** Reporte de Control de Asistencia por sede. Trae el agregado compacto del RPC
 *  (no check-ins crudos) y calcula las series para (año, sede) server-side. */
export async function getCharlaAttendanceReport(opts: { year?: number; sede?: string } = {}): Promise<CharlaReport> {
  const supabase = createAdminClient()
  // El RPC devuelve miles de filas (año × etiqueta × semana × mes). PostgREST
  // corta cada respuesta en 1000 filas (db-max-rows), así que SIN paginar solo
  // llegaban ~1000 de ~3000 → promedios mensuales subestimados (bug del 10x).
  // Paginamos con .range() hasta agotar.
  const rows: CharlaAggRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.rpc('report_charla_attendance').range(from, from + 999)
    if (error) throw error
    const batch = (data ?? []) as CharlaAggRow[]
    rows.push(...batch)
    if (batch.length < 1000) break
  }
  return buildCharlaReport(rows, opts)
}

/** Reporte de Crecimiento (personas nuevas). Trae el agregado compacto del RPC
 *  `report_member_growth` (no filas crudas) y calcula las series para (año, sede). */
export async function getMemberGrowthReport(opts: { year?: number; sede?: string } = {}): Promise<GrowthReport> {
  const supabase = createAdminClient()
  // Mismo patrón de paginación que asistencia (PostgREST corta en 1000 filas).
  const rows: GrowthAggRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.rpc('report_member_growth').range(from, from + 999)
    if (error) throw error
    const batch = (data ?? []) as GrowthAggRow[]
    rows.push(...batch)
    if (batch.length < 1000) break
  }
  return buildGrowthReport(rows, opts)
}

/** Reporte de Discípulos Multiplicadores. Trae los flags por-persona del RPC
 *  `get_dm_flags` (paginado, PostgREST corta en 1000) + el agregado de hitos de
 *  `get_dm_milestones`, y arma el payload para el año de cohorte seleccionado. */
export async function getDiscipulosReport(opts: { cohortYear?: number } = {}): Promise<DiscipulosReport> {
  const supabase = createAdminClient()
  const flags: DmFlagRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.rpc('get_dm_flags').range(from, from + 999)
    if (error) throw error
    const batch = (data ?? []) as DmFlagRow[]
    flags.push(...batch)
    if (batch.length < 1000) break
  }
  const { data: msData, error: msError } = await supabase.rpc('get_dm_milestones')
  if (msError) throw msError
  return buildDiscipulosReport(flags, (msData ?? []) as DmMilestoneRow[], opts)
}
