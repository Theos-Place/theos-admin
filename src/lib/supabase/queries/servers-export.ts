import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { canonicalCharlaTitle } from '@/lib/sedes-canonical'
import { ATTENDANCE_MIN_CHARLAS_GENERAL, attendanceWindowStart } from '@/lib/attendance'

// Export de aplicantes de las vacantes seleccionadas (punto 6). Una fila por
// APLICACIÓN (persona + el puesto al que aplicó). Los multivaluados (estudios,
// servicios) se concatenan con "; " para no romper el CSV separado por comas.
export type ApplicantExportRow = {
  member_id: string
  nombre: string
  cedula: string
  email: string
  telefono: string
  provincia: string
  historial_estudios: string
  sede: string
  miembro_activo: string
  servicios_activos: string
  puesto_aplicado: string
}

type AppRow = {
  applicant_id: string
  vacancy: {
    title: string | null
    position: string | null
    committee: { name: string } | null
  } | null
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

export async function getVacancyApplicantsExport(vacancyIds: string[]): Promise<ApplicantExportRow[]> {
  if (vacancyIds.length === 0) return []
  const supabase = createAdminClient()

  // 1) Aplicaciones de esas vacantes (una fila por aplicación).
  const { data: apps } = await supabase
    .from('applications')
    .select('applicant_id, vacancy:vacancies(title, position, committee:areas!vacancies_committee_id_fkey(name))')
    .in('vacancy_id', vacancyIds)
    .order('applied_at', { ascending: false })
  const appRows = ((apps ?? []) as unknown[]).map(r => {
    const row = r as { applicant_id: string; vacancy: unknown }
    return { applicant_id: row.applicant_id, vacancy: one(row.vacancy) } as AppRow
  })
  if (appRows.length === 0) return []

  const memberIds = [...new Set(appRows.map(a => a.applicant_id))]

  // 2) Perfiles.
  const { data: members } = await supabase
    .from('members')
    .select('id, cedula, first_name, last_name, email, phone, province')
    .in('id', memberIds)
  const memberById = new Map(
    ((members ?? []) as Array<Record<string, string | null>>).map(m => [m.id as string, m]),
  )

  // 3) Servicios activos (volunteers status='active') → "Comité — Puesto".
  const { data: vols } = await supabase
    .from('volunteers')
    .select('member_id, status, position:service_positions!volunteers_position_id_fkey(title, area:areas!service_positions_area_id_fkey(name))')
    .in('member_id', memberIds)
    .eq('status', 'active')
  const servicesByMember = new Map<string, string[]>()
  for (const v of (vols ?? []) as Array<{ member_id: string; position: unknown }>) {
    const pos = one(v.position) as { title: string | null; area: { name: string } | { name: string }[] | null } | null
    const area = one(pos?.area)
    const label = [area?.name, pos?.title].filter(Boolean).join(' — ')
    if (!label) continue
    const arr = servicesByMember.get(v.member_id) ?? []
    arr.push(label)
    servicesByMember.set(v.member_id, arr)
  }

  // 4) Historial de estudios (study_enrollments → plan por grupo o directo).
  const { data: enr } = await supabase
    .from('study_enrollments')
    .select('member_id, group:study_groups!study_enrollments_group_id_fkey(plan:study_plans(name)), plan_direct:study_plans!study_enrollments_plan_id_fkey(name)')
    .in('member_id', memberIds)
  const studiesByMember = new Map<string, Set<string>>()
  for (const e of (enr ?? []) as Array<{ member_id: string; group: unknown; plan_direct: unknown }>) {
    const grp = one(e.group) as { plan: { name: string } | { name: string }[] | null } | null
    const planName = one(grp?.plan)?.name ?? one(e.plan_direct as { name: string } | null)?.name ?? null
    if (!planName) continue
    const set = studiesByMember.get(e.member_id) ?? new Set<string>()
    set.add(planName)
    studiesByMember.set(e.member_id, set)
  }

  // 5) Sede (más asistida, canónica, últimos 12 meses) + miembro activo (>= 6
  //    check-ins de charla en los últimos 6 meses).
  const start12 = attendanceWindowStart(12)
  const start6 = attendanceWindowStart(6)
  const { data: chk } = await supabase
    .from('event_checkins')
    .select('member_id, checked_in_at, events!inner(event_type, title)')
    .eq('events.event_type', 'charla')
    .in('member_id', memberIds)
    .gte('checked_in_at', start12)
  const sedeTally = new Map<string, Map<string, number>>() // member → sede → count
  const recentCount = new Map<string, number>()            // member → charlas últimos 6m
  for (const c of (chk ?? []) as Array<{ member_id: string; checked_in_at: string | null; events: unknown }>) {
    if (!c.checked_in_at) continue
    const ev = one(c.events) as { title: string | null } | null
    const canonical = ev?.title ? canonicalCharlaTitle(ev.title) : null
    if (canonical) {
      const name = canonical.replace(/^Charla\s+/, '')
      const t = sedeTally.get(c.member_id) ?? new Map<string, number>()
      t.set(name, (t.get(name) ?? 0) + 1)
      sedeTally.set(c.member_id, t)
    }
    if (c.checked_in_at >= start6) recentCount.set(c.member_id, (recentCount.get(c.member_id) ?? 0) + 1)
  }
  const sedeOf = (memberId: string): string => {
    const t = sedeTally.get(memberId)
    if (!t) return ''
    let best = '', bestN = -1
    for (const [name, n] of t) if (n > bestN) { best = name; bestN = n }
    return best
  }

  // 6) Armar filas (una por aplicación).
  return appRows.map(a => {
    const m = memberById.get(a.applicant_id)
    const nombre = m ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() : ''
    const com = a.vacancy?.committee?.name ?? ''
    const puesto = a.vacancy?.position || a.vacancy?.title || ''
    const active = (recentCount.get(a.applicant_id) ?? 0) >= ATTENDANCE_MIN_CHARLAS_GENERAL
    return {
      member_id: a.applicant_id,
      nombre,
      cedula: m?.cedula ?? '',
      email: m?.email ?? '',
      telefono: m?.phone ?? '',
      provincia: m?.province ?? '',
      historial_estudios: [...(studiesByMember.get(a.applicant_id) ?? [])].join('; '),
      sede: sedeOf(a.applicant_id),
      miembro_activo: active ? 'Sí' : 'No',
      servicios_activos: (servicesByMember.get(a.applicant_id) ?? []).join('; '),
      puesto_aplicado: [com, puesto].filter(Boolean).join(' — '),
    }
  })
}
