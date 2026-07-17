// Análisis de demanda de un estudio (categorías "por graduarse" y "elegibles").
// Extraído de studies.ts (auditoría 2026-06: archivos gigantes). Re-exportado por
// studies.ts para no tocar a los consumidores.
import { createAdminClient } from '@/lib/supabase/admin'
// Mapa nivel→etapa y compromisos por etapa: fuente única (QA 2026-07-17 —
// antes esta copia local exigía asistencia para 'niveles' cuando la
// elegibilidad de matrícula no exige nada, y los números no cuadraban).
import { LEVEL_TO_STAGE, requirementsForStage } from '@/lib/studies/eligibility'
import { ATTENDANCE_MIN_CHARLAS_INTERMEDIA } from '@/lib/attendance'

export type StudyDemandRow = {
  zone: string
  graduating: number
  eligible: number
  graduating_members: string[]
  eligible_members: string[]
}

export type StudyDemandResult = {
  rows: StudyDemandRow[]
  totalGraduating: number
  totalEligible: number
  studyInfo: {
    code: string
    name: string
    weeks: number
    stage: string
    prerequisite: string | null
    requirements: string[]
  }
}

/**
 * Demanda estimada de un estudio para el bloque siguiente.
 *
 * Categoría A "por graduarse": inscritos HOY en el prerequisito, con fecha de
 * inicio conocida y ≥50% de las semanas cursadas (o ≤5 semanas restantes),
 * sin inscripción activa en el objetivo y cumpliendo los compromisos de la etapa.
 *
 * Categoría B "elegibles": completaron el prerequisito, no están inscritos ni
 * completaron el objetivo, no están en A, y cumplen los compromisos.
 *
 * Compromisos por etapa del estudio OBJETIVO (mismos mínimos que la
 * elegibilidad de matrícula — ver studies-eligibility.ts):
 *   inicial    → asistencia activa (NO pide donador)
 *   intermedia → donador + asistencia activa + servidor activo en comité
 *
 * Zona: sede del miembro; si no tiene, su provincia.
 */
export async function getStudyDemand(studyCode: string, now: Date = new Date()): Promise<StudyDemandResult> {
  const supabase = createAdminClient()

  // Plan objetivo: etapa, semanas y prerequisito.
  const { data: planRow, error: pErr } = await supabase
    .from('study_plans')
    .select('id, code, name, level, duration_weeks, prerequisite_code, is_curricular')
    .eq('code', studyCode)
    .maybeSingle()
  if (pErr) throw pErr
  const plan = planRow as { id: string; code: string; name: string; level: string; duration_weeks: number | null; prerequisite_code: string | null; is_curricular: boolean } | null
  if (!plan) throw new Error(`Plan ${studyCode} no encontrado`)
  const prereq = plan.prerequisite_code

  const stage = LEVEL_TO_STAGE[plan.level] ?? plan.level
  const stageReq = requirementsForStage(stage)
  const requirements = [
    ...(stageReq.donor ? ['donador'] : []),
    ...(stageReq.attendance !== 'none' ? ['asistencia'] : []),
    ...(stageReq.server ? ['servidor'] : []),
  ]

  const studyInfo = {
    code: plan.code,
    name: plan.name,
    weeks: plan.duration_weeks ?? 0,
    stage,
    prerequisite: prereq,
    requirements,
  }

  const emptyResult = { rows: [] as StudyDemandRow[], totalGraduating: 0, totalEligible: 0, studyInfo }

  // Charlas introductorias (ej. BUS) no participan del análisis.
  if (!plan.is_curricular) return emptyResult

  // Descendientes del estudio en la cadena de prerequisitos: quien completó
  // cualquiera de ellos (o el estudio mismo) ya pasó por acá y NO es demanda.
  // Ej: completó PAN → fuera de DIS1, DIS2, DIS3 y CTBD.
  const { data: allPlanRows, error: apErr } = await supabase
    .from('study_plans')
    .select('code, prerequisite_code')
  if (apErr) throw apErr
  const childrenOf = new Map<string, string[]>()
  for (const r of (allPlanRows ?? []) as Array<{ code: string | null; prerequisite_code: string | null }>) {
    if (!r.code || !r.prerequisite_code) continue
    const arr = childrenOf.get(r.prerequisite_code) ?? []
    arr.push(r.code)
    childrenOf.set(r.prerequisite_code, arr)
  }
  const descendants = new Set<string>()
  const stack = [plan.code]
  while (stack.length > 0) {
    for (const child of childrenOf.get(stack.pop()!) ?? []) {
      if (!descendants.has(child)) { descendants.add(child); stack.push(child) }
    }
  }

  // Compromisos: asistencia con el mínimo de la etapa (general = 6; Etapa
  // Intermedia = criterio reforzado de 12), mismo criterio que la elegibilidad.
  const attendanceMin = stageReq.attendance === 'intermedia' ? ATTENDANCE_MIN_CHARLAS_INTERMEDIA : undefined
  const { getActiveAttendanceMemberIds, getServerMemberIds } = await import('./members')
  const [attendanceIds, serverIds] = await Promise.all([
    requirements.includes('asistencia') ? getActiveAttendanceMemberIds(attendanceMin) : Promise.resolve([]),
    requirements.includes('servidor') ? getServerMemberIds() : Promise.resolve([]),
  ])
  const attendanceSet = new Set(attendanceIds)
  const serverSet = new Set(serverIds)

  // Sin prerequisito en cadena (ej. estudios por invitación CDEB/CDC): la
  // demanda se estima por los compromisos de la etapa (asistencia + donador
  // + servidor según corresponda), excluyendo a quien ya lo cursa o completó.
  if (!prereq) {
    // Niveles y campañas no piden compromisos → sin universo de candidatos
    // para estimar demanda (la UI de análisis solo ofrece inicial/intermedia).
    if (requirements.length === 0) return emptyResult

    let candidateIds = requirements.includes('asistencia') ? attendanceIds : serverIds
    if (requirements.includes('servidor')) candidateIds = candidateIds.filter(id => serverSet.has(id))

    // Ya inscritos o con el estudio completado (vía grupo o plan directo).
    const [directRes, viaGroupRes] = await Promise.all([
      supabase
        .from('study_enrollments')
        .select('member_id')
        .eq('plan_id', plan.id)
        .in('status', ['enrolled', 'completed']),
      supabase
        .from('study_enrollments')
        .select('member_id, group:study_groups!study_enrollments_group_id_fkey!inner(plan_id)')
        .eq('group.plan_id', plan.id)
        .in('status', ['enrolled', 'completed']),
    ])
    if (directRes.error) throw directRes.error
    if (viaGroupRes.error) throw viaGroupRes.error
    const excluded = new Set([
      ...((directRes.data ?? []) as Array<{ member_id: string }>).map(r => r.member_id),
      ...((viaGroupRes.data ?? []) as Array<{ member_id: string }>).map(r => r.member_id),
    ])

    const zonesFallback = new Map<string, { graduating: string[]; eligible: string[] }>()
    const pending = candidateIds.filter(id => !excluded.has(id))
    for (let i = 0; i < pending.length; i += 400) {
      const { data, error } = await supabase
        .from('members')
        .select('id, is_donor, is_active, province, sede:sedes(code)')
        .in('id', pending.slice(i, i + 400))
      if (error) throw error
      for (const m of (data ?? []) as Array<{ id: string; is_donor: boolean; is_active: boolean; province: string | null; sede: { code: string } | null }>) {
        if (!m.is_active) continue
        if (requirements.includes('donador') && !m.is_donor) continue
        const zoneKey = m.sede?.code ?? m.province ?? 'Sin zona'
        const zone = zonesFallback.get(zoneKey) ?? { graduating: [], eligible: [] }
        zone.eligible.push(m.id)
        zonesFallback.set(zoneKey, zone)
      }
    }

    const fallbackRows: StudyDemandRow[] = Array.from(zonesFallback.entries())
      .map(([zone, v]) => ({
        zone,
        graduating: 0,
        eligible: v.eligible.length,
        graduating_members: [],
        eligible_members: v.eligible,
      }))
      .filter(r => r.eligible > 0)
      .sort((a, b) => b.eligible - a.eligible)

    return {
      rows: fallbackRows,
      totalGraduating: 0,
      totalEligible: fallbackRows.reduce((s, r) => s + r.eligible, 0),
      studyInfo,
    }
  }

  // Semanas totales del prerequisito, para el umbral de avance de Categoría A.
  const { data: prereqPlan } = await supabase
    .from('study_plans')
    .select('duration_weeks')
    .eq('code', prereq)
    .maybeSingle()
  const prereqWeeks = (prereqPlan as { duration_weeks: number | null } | null)?.duration_weeks ?? null

  // Inscripciones (activas + completadas) con inicio del grupo, código del plan
  // y datos del miembro (compromisos + zona). Paginado: PostgREST corta en 1000.
  type EnrollRow = {
    member_id: string
    status: string
    group: { starts_at: string | null; plan: { code: string | null } | null } | null
    // Inscripciones sin grupo (histórico): el plan viene directo (migración 032).
    plan_direct: { code: string | null } | null
    member: { is_donor: boolean; province: string | null; is_active: boolean; sede: { code: string } | null } | null
  }
  const enrollments: EnrollRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('study_enrollments')
      .select(`
        member_id, status,
        group:study_groups!study_enrollments_group_id_fkey(starts_at, plan:study_plans(code)),
        plan_direct:study_plans!study_enrollments_plan_id_fkey(code),
        member:members(is_donor, province, is_active, sede:sedes(code))
      `)
      .in('status', ['enrolled', 'completed'])
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    const batch = (data ?? []) as EnrollRow[]
    enrollments.push(...batch)
    if (batch.length < 1000) break
  }

  type MemberState = {
    zone: string
    isDonor: boolean
    isActive: boolean
    completedPrereq: boolean
    enrolledTarget: boolean
    completedTarget: boolean
    completedDescendant: boolean // completó un estudio POSTERIOR en la cadena
    prereqStartsAt: string | null // inicio del grupo de su inscripción ACTIVA en el prereq
  }
  const byMember = new Map<string, MemberState>()
  for (const r of enrollments) {
    const code = r.group?.plan?.code ?? r.plan_direct?.code
    if (!code) continue
    const entry = byMember.get(r.member_id) ?? {
      zone: r.member?.sede?.code ?? r.member?.province ?? 'Sin zona',
      isDonor: r.member?.is_donor ?? false,
      isActive: r.member?.is_active ?? true,
      completedPrereq: false,
      enrolledTarget: false,
      completedTarget: false,
      completedDescendant: false,
      prereqStartsAt: null,
    }
    if (code === prereq) {
      if (r.status === 'completed') entry.completedPrereq = true
      if (r.status === 'enrolled') entry.prereqStartsAt = r.group?.starts_at ?? entry.prereqStartsAt
    }
    if (code === studyCode) {
      if (r.status === 'enrolled') entry.enrolledTarget = true
      if (r.status === 'completed') entry.completedTarget = true
    }
    if (descendants.has(code) && r.status === 'completed') entry.completedDescendant = true
    byMember.set(r.member_id, entry)
  }

  function meetsCommitments(memberId: string, m: MemberState): boolean {
    if (requirements.includes('donador') && !m.isDonor) return false
    if (requirements.includes('asistencia') && !attendanceSet.has(memberId)) return false
    if (requirements.includes('servidor') && !serverSet.has(memberId)) return false
    return true
  }

  const zones = new Map<string, { graduating: string[]; eligible: string[] }>()
  const nowMs = now.getTime()

  for (const [memberId, m] of byMember) {
    if (!m.isActive || m.enrolledTarget || m.completedTarget) continue
    // Completó un estudio posterior de la cadena → ya pasó por acá, no es demanda.
    if (m.completedDescendant) continue
    if (!meetsCommitments(memberId, m)) continue

    // Categoría A: cursando el prereq con avance suficiente
    // (≥50% de las semanas o ≤5 semanas restantes).
    let isGraduating = false
    if (m.prereqStartsAt && prereqWeeks && prereqWeeks > 0) {
      const weeksElapsed = (nowMs - new Date(m.prereqStartsAt).getTime()) / (7 * 86400000)
      isGraduating = weeksElapsed >= prereqWeeks / 2 || prereqWeeks - weeksElapsed <= 5
    }

    if (!isGraduating && !m.completedPrereq) continue

    const zone = zones.get(m.zone) ?? { graduating: [], eligible: [] }
    if (isGraduating) zone.graduating.push(memberId)
    else zone.eligible.push(memberId) // Categoría B (excluye a los de A)
    zones.set(m.zone, zone)
  }

  const rowsOut: StudyDemandRow[] = Array.from(zones.entries())
    .map(([zone, v]) => ({
      zone,
      graduating: v.graduating.length,
      eligible: v.eligible.length,
      graduating_members: v.graduating,
      eligible_members: v.eligible,
    }))
    .filter(r => r.graduating + r.eligible > 0)
    .sort((a, b) => (b.graduating + b.eligible) - (a.graduating + a.eligible))

  return {
    rows: rowsOut,
    totalGraduating: rowsOut.reduce((s, r) => s + r.graduating, 0),
    totalEligible: rowsOut.reduce((s, r) => s + r.eligible, 0),
    studyInfo,
  }
}
