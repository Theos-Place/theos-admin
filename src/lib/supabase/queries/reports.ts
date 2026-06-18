import { createAdminClient } from '@/lib/supabase/admin'
import { buildCharlaReport, type CharlaAggRow, type CharlaReport } from '@/lib/reports/charla-attendance'

/** Reporte de Control de Asistencia por sede. Trae el agregado compacto del RPC
 *  (no check-ins crudos) y calcula las series para (año, sede) server-side. */
export async function getCharlaAttendanceReport(opts: { year?: number; sede?: string } = {}): Promise<CharlaReport> {
  const supabase = createAdminClient()
  // RPC creado en migración 070; aún no está en los tipos generados de Supabase.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('report_charla_attendance')
  if (error) throw error
  const rows = (data ?? []) as CharlaAggRow[]
  return buildCharlaReport(rows, opts)
}
