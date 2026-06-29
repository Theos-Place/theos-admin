// Criterio de "asistencia activa" (check-ins de CHARLA) y resolución de ids.
// Extraído de members.ts (auditoría 2026-06: archivos gigantes). Re-exportado
// por members.ts para no tocar a los consumidores.
import { createAdminClient } from '@/lib/supabase/admin'
import { ATTENDANCE_MONTHS_GENERAL, ATTENDANCE_MIN_CHARLAS_GENERAL } from '@/lib/attendance'

// Ventanas del criterio — fuente única en @/lib/attendance (módulo puro, importable
// desde cliente). Re-exportadas para los consumidores server.
export { ATTENDANCE_MONTHS_GENERAL, ATTENDANCE_MONTHS_STUDIES, ATTENDANCE_MIN_CHARLAS_GENERAL } from '@/lib/attendance'

/** Últimos N meses calendario COMPLETOS (YYYY-MM), excluyendo el mes en curso:
 *  incluirlo dejaría a todo el mundo afuera los primeros días de cada mes. */
export function lastCompleteMonthsKeys(n = ATTENDANCE_MONTHS_GENERAL, now = new Date()): string[] {
  const out: string[] = []
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1) // mes anterior
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

/** Criterio de asistencia activa: dado el set de meses (YYYY-MM) con al menos un
 *  check-in de CHARLA, exige cobertura de los últimos `months` meses completos.
 *  `months` default = GENERAL (12); estudios pasa STUDIES (6). */
export function attendanceMonthsSatisfyCriteria(monthsSet: Iterable<string>, months = ATTENDANCE_MONTHS_GENERAL, now = new Date()): boolean {
  const set = monthsSet instanceof Set ? monthsSet : new Set(monthsSet)
  return lastCompleteMonthsKeys(months, now).every((m) => set.has(m))
}

/** Ids de miembros con asistencia activa. Dos modos según `minCount`:
 *   · CONTEO (general): pasá `minCount` → ≥ `minCount` check-ins de CHARLA en los
 *     últimos `months` meses completos (≈1 por mes). Usado por la lista/chip.
 *   · COBERTURA (estudios): sin `minCount` → ≥1 check-in en CADA uno de los
 *     últimos `months` meses. Usado por demanda de estudios.
 *  Devuelve [] si falla — nunca lanza. */
export async function getActiveAttendanceMemberIds(
  months = ATTENDANCE_MONTHS_GENERAL,
  minCount?: number,
): Promise<string[]> {
  try {
    const supabase = createAdminClient()
    const monthsKeys = lastCompleteMonthsKeys(months)
    const oldest = `${monthsKeys[monthsKeys.length - 1]}-01` // inicio del mes más viejo
    const byMemberMonths = new Map<string, Set<string>>() // cobertura
    const byMemberCount = new Map<string, number>()        // conteo
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('event_checkins')
        .select('member_id, checked_in_at, events!inner(event_type)')
        .eq('events.event_type', 'charla')
        .gte('checked_in_at', oldest)
        .order('id')
        .range(from, from + 999)
      if (error) {
        console.warn('getActiveAttendanceMemberIds:', error.message)
        return []
      }
      for (const r of (data ?? []) as Array<{ member_id: string | null; checked_in_at: string | null }>) {
        if (!r?.member_id || !r?.checked_in_at) continue
        if (minCount != null) {
          byMemberCount.set(r.member_id, (byMemberCount.get(r.member_id) ?? 0) + 1)
        } else {
          const mo = r.checked_in_at.slice(0, 7)
          if (!byMemberMonths.has(r.member_id)) byMemberMonths.set(r.member_id, new Set())
          byMemberMonths.get(r.member_id)!.add(mo)
        }
      }
      if ((data ?? []).length < 1000) break
    }
    const out: string[] = []
    if (minCount != null) {
      for (const [id, n] of byMemberCount) if (n >= minCount) out.push(id)
    } else {
      for (const [id, set] of byMemberMonths) if (attendanceMonthsSatisfyCriteria(set, months)) out.push(id)
    }
    return out
  } catch (e) {
    console.warn('getActiveAttendanceMemberIds:', e)
    return []
  }
}
