// Criterio de "asistencia activa" (check-ins de CHARLA) y resolución de ids.
// Extraído de members.ts (auditoría 2026-06: archivos gigantes). Re-exportado
// por members.ts para no tocar a los consumidores.
import { createAdminClient } from '@/lib/supabase/admin'
import { attendanceWindowStart, attendanceRecencyStart, meetsAttendanceCriteria, ATTENDANCE_MIN_CHARLAS } from '@/lib/attendance'

// Fuente única del criterio en @/lib/attendance (módulo puro, importable
// desde cliente). Re-exportado para los consumidores server.
export { ATTENDANCE_MONTHS, ATTENDANCE_MIN_CHARLAS, ATTENDANCE_RECENCY_DAYS, meetsAttendanceCriteria } from '@/lib/attendance'

/** Ids de miembros que cumplen el criterio de asistencia activa: ≥`minCount`
 *  check-ins de charla en los últimos 6 meses Y al menos uno en los últimos
 *  60 días. Default = criterio general (6); Etapa Intermedia pasa el reforzado
 *  (ATTENDANCE_MIN_CHARLAS_INTERMEDIA). Devuelve [] si falla — nunca lanza. */
export async function getActiveAttendanceMemberIds(minCount = ATTENDANCE_MIN_CHARLAS): Promise<string[]> {
  try {
    const supabase = createAdminClient()
    const oldest = attendanceWindowStart()
    const recentSince = attendanceRecencyStart()

    // A16 (auditoría de rendimiento): el agregado en SQL resuelve en pocos
    // round trips lo que el loop de abajo hacía en ~19. El loop queda como
    // fallback por si el RPC no está desplegado.
    // QA 2026-07-17: PostgREST corta la respuesta del RPC en db-max-rows
    // (1000) y ya hay >1000 activos — se pagina con .range() (el RPC ordena
    // por member_id, migración 134). Si una página falla, cae al fallback.
    let rpcFailed = false
    const rpcIds: string[] = []
    for (let from = 0; ; from += 1000) {
      const { data: rpcData, error: rpcErr } = await supabase
        .rpc('active_attendance_member_ids', {
          p_oldest: `${oldest}T00:00:00Z`,
          p_min_count: minCount,
          p_recency_since: recentSince,
        })
        .range(from, from + 999)
      if (rpcErr || !rpcData) {
        console.warn('active_attendance_member_ids RPC falló, usando fallback:', rpcErr?.message)
        rpcFailed = true
        break
      }
      const batch = rpcData as Array<{ member_id: string }>
      for (const r of batch) rpcIds.push(r.member_id)
      if (batch.length < 1000) break
    }
    if (!rpcFailed) return rpcIds
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
    for (const [id, dates] of byMember) if (meetsAttendanceCriteria(dates, { minCount })) out.push(id)
    return out
  } catch (e) {
    console.warn('getActiveAttendanceMemberIds:', e)
    return []
  }
}
