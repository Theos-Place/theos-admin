// Criterio de "asistencia activa" (check-ins de CHARLA) y resolución de ids.
// Extraído de members.ts (auditoría 2026-06: archivos gigantes). Re-exportado
// por members.ts para no tocar a los consumidores.
import { createAdminClient } from '@/lib/supabase/admin'
import { attendanceWindowStart, attendanceRecencyStart, meetsAttendanceCriteria, ATTENDANCE_MIN_CHARLAS } from '@/lib/attendance'

// Fuente única del criterio en @/lib/attendance (módulo puro, importable
// desde cliente). Re-exportado para los consumidores server.
export { ATTENDANCE_MONTHS, ATTENDANCE_MIN_CHARLAS, ATTENDANCE_RECENCY_DAYS, meetsAttendanceCriteria } from '@/lib/attendance'

/** Ids de miembros que cumplen el criterio ÚNICO de asistencia activa: ≥6
 *  check-ins de charla en los últimos 6 meses Y al menos uno en los últimos
 *  60 días. Mismo criterio para filtros, sede, dashboard, elegibilidad de
 *  estudios, invitaciones y matrícula. Devuelve [] si falla — nunca lanza. */
export async function getActiveAttendanceMemberIds(): Promise<string[]> {
  try {
    const supabase = createAdminClient()
    const oldest = attendanceWindowStart()
    const recentSince = attendanceRecencyStart()

    // A16 (auditoría de rendimiento): el agregado en SQL resuelve en un solo
    // round trip lo que el loop de abajo hacía en ~19 round trips. El loop
    // queda como fallback por si el RPC no está desplegado.
    const { data: rpcData, error: rpcErr } = await supabase.rpc('active_attendance_member_ids', {
      p_oldest: `${oldest}T00:00:00Z`,
      p_min_count: ATTENDANCE_MIN_CHARLAS,
      p_recency_since: recentSince,
    })
    if (!rpcErr && rpcData) {
      return (rpcData as Array<{ member_id: string }>).map(r => r.member_id)
    }
    console.warn('active_attendance_member_ids RPC no disponible, usando fallback:', rpcErr?.message)
    const byMember = new Map<string, string[]>()
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('event_checkins')
        .select('member_id, checked_in_at, events!inner(event_type)')
        .eq('events.event_type', 'charla')
        .gte('checked_in_at', `${oldest}T00:00:00Z`)
        .order('id')
        .range(from, from + 999)
      if (error) {
        console.warn('getActiveAttendanceMemberIds:', error.message)
        return []
      }
      for (const r of (data ?? []) as Array<{ member_id: string | null; checked_in_at: string | null }>) {
        if (!r?.member_id || !r?.checked_in_at) continue
        const arr = byMember.get(r.member_id) ?? []
        arr.push(r.checked_in_at)
        byMember.set(r.member_id, arr)
      }
      if ((data ?? []).length < 1000) break
    }
    const out: string[] = []
    for (const [id, dates] of byMember) if (meetsAttendanceCriteria(dates)) out.push(id)
    return out
  } catch (e) {
    console.warn('getActiveAttendanceMemberIds:', e)
    return []
  }
}
