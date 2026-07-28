import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { meetsAttendanceCriteria } from '@/lib/attendance'

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

// QA 2026-07-17: los .in('member_id', ...) van troceados a ≤300 ids — un set
// grande de aplicantes reventaba por URL gigante (mismo antecedente del 500).
function chunk<T>(arr: T[], size = 300): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
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
  const memberById = new Map<string, Record<string, string | null>>()
  for (const slice of chunk(memberIds)) {
    const { data: members } = await supabase
      .from('members')
      .select('id, cedula, first_name, last_name, email, phone, province, sede:sedes(name)')
      .in('id', slice)
    for (const m of (members ?? []) as Array<Record<string, string | null>>) memberById.set(m.id as string, m)
  }

  // 3) Servicios activos (volunteers status='active') → "Comité — Puesto".
  const servicesByMember = new Map<string, string[]>()
  const allVols: Array<{ member_id: string; position: unknown }> = []
  for (const slice of chunk(memberIds)) {
    const { data: vols } = await supabase
      .from('volunteers')
      .select('member_id, status, position:service_positions!volunteers_position_id_fkey(title, area:areas!service_positions_area_id_fkey(name))')
      .in('member_id', slice)
      .eq('status', 'active')
    allVols.push(...((vols ?? []) as Array<{ member_id: string; position: unknown }>))
  }
  for (const v of allVols) {
    const pos = one(v.position) as { title: string | null; area: { name: string } | { name: string }[] | null } | null
    const area = one(pos?.area)
    const label = [area?.name, pos?.title].filter(Boolean).join(' — ')
    if (!label) continue
    const arr = servicesByMember.get(v.member_id) ?? []
    arr.push(label)
    servicesByMember.set(v.member_id, arr)
  }

  // 4) Historial de estudios (study_enrollments → plan por grupo o directo).
  const studiesByMember = new Map<string, Set<string>>()
  const allEnr: Array<{ member_id: string; group: unknown; plan_direct: unknown }> = []
  for (const slice of chunk(memberIds)) {
    const { data: enr } = await supabase
      .from('study_enrollments')
      .select('member_id, group:study_groups!study_enrollments_group_id_fkey(plan:study_plans(name)), plan_direct:study_plans!study_enrollments_plan_id_fkey(name)')
      .in('member_id', slice)
    allEnr.push(...((enr ?? []) as Array<{ member_id: string; group: unknown; plan_direct: unknown }>))
  }
  for (const e of allEnr) {
    const grp = one(e.group) as { plan: { name: string } | { name: string }[] | null } | null
    const planName = one(grp?.plan)?.name ?? one(e.plan_direct as { name: string } | null)?.name ?? null
    if (!planName) continue
    const set = studiesByMember.get(e.member_id) ?? new Set<string>()
    set.add(planName)
    studiesByMember.set(e.member_id, set)
  }

  // 5) Sede (criterio único, src/lib/sede-attendance.ts — activo = más
  //    asistida en 6 meses; inactivo = más asistida en los 6 meses previos a
  //    la última asistencia) + miembro activo (criterio único: >= 6 check-ins
  //    de charla en los últimos 6 meses, con al menos uno en los últimos 60 días).
  //    Historial completo (sin recorte de fecha): el caso inactivo puede
  //    necesitar mirar más de 12 meses atrás.
  const checkinsByMember = new Map<string, Array<{ checked_in_at: string | null; title: string | null }>>()
  const allChk: Array<{ member_id: string; checked_in_at: string | null; events: unknown }> = []
  for (const slice of chunk(memberIds)) {
    const { data: chk } = await supabase
      .from('event_checkins')
      .select('member_id, checked_in_at, events!inner(event_type, title)')
      .eq('events.event_type', 'charla')
      .in('member_id', slice)
    allChk.push(...((chk ?? []) as Array<{ member_id: string; checked_in_at: string | null; events: unknown }>))
  }
  for (const c of allChk) {
    const ev = one(c.events) as { title: string | null } | null
    const arr = checkinsByMember.get(c.member_id) ?? []
    arr.push({ checked_in_at: c.checked_in_at, title: ev?.title ?? null })
    checkinsByMember.set(c.member_id, arr)
  }
  // REF-1: la sede sale de lo PERSISTIDO (members.sede_id → sedes.name),
  // mantenido por la única implementación SQL de la regla. Los check-ins de
  // arriba se siguen usando para meetsAttendanceCriteria (eso no cambia).
  const sedeOf = (memberId: string): string => {
    const m = memberById.get(memberId) as Record<string, unknown> | undefined
    const s = m?.sede
    const row = Array.isArray(s) ? s[0] : s
    return (row as { name?: string | null } | null)?.name ?? ''
  }

  // 6) Armar filas (una por aplicación).
  return appRows.map(a => {
    const m = memberById.get(a.applicant_id)
    const nombre = m ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() : ''
    const com = a.vacancy?.committee?.name ?? ''
    const puesto = a.vacancy?.position || a.vacancy?.title || ''
    const active = meetsAttendanceCriteria((checkinsByMember.get(a.applicant_id) ?? []).map(c => c.checked_in_at ?? ''))
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
