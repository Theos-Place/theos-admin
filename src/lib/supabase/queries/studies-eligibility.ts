// Perfil académico y elegibilidad de matrícula de un miembro. Extraído de
// studies.ts (auditoría 2026-06: archivos gigantes). Re-exportado por studies.ts.
import { createAdminClient } from '@/lib/supabase/admin'

/** Perfil académico de un miembro para calcular elegibilidad de matrícula.
 *  Devuelve los CÓDIGOS de plan (no nombres) y los compromisos reales. */
export async function getMemberStudyProfile(memberId: string): Promise<{
  completed_codes: string[]
  current_code: string | null
  is_donor: boolean
  is_server: boolean
  charla_count: number
  invited_codes: string[]
}> {
  const supabase = createAdminClient()
  // charla_count: solo los últimos 6 meses — el criterio de matrícula es
  // deliberadamente MÁS estricto que el criterio general de asistencia
  // (decisión 2026-06-11: 12 charlas en 6 meses vs cobertura mensual).
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const { activeInvitationCodesForMember } = await import('./study-invitations')
  const [memberRes, enrRes, volRes, chkRes, invitedCodes] = await Promise.all([
    supabase.from('members').select('is_donor').eq('id', memberId).maybeSingle(),
    supabase
      .from('study_enrollments')
      .select('status, study_groups!study_enrollments_group_id_fkey(plan:study_plans(code)), plan_direct:study_plans!study_enrollments_plan_id_fkey(code)')
      .eq('member_id', memberId),
    supabase.from('volunteers').select('id').eq('member_id', memberId).eq('status', 'active').limit(1),
    supabase
      .from('event_checkins')
      .select('id, events!inner(event_type)')
      .eq('member_id', memberId)
      .eq('events.event_type', 'charla')
      .gte('checked_in_at', sixMonthsAgo.toISOString()),
    activeInvitationCodesForMember(memberId),
  ])

  // Completados/actual resueltos por grupo O por plan directo (inscripciones sin
  // grupo, p.ej. histórico de campañas) — criterio centralizado de elegibilidad (B1).
  const enrollments = (enrRes.data ?? []) as Array<{ status: string; study_groups: { plan: { code: string } | null } | null; plan_direct: { code: string } | null }>
  const codeOf = (e: typeof enrollments[number]) => e.study_groups?.plan?.code ?? e.plan_direct?.code ?? null
  const completed_codes = enrollments
    .filter(e => e.status === 'completed' && codeOf(e))
    .map(e => codeOf(e)!)
  const current_code = enrollments
    .map(e => e.status === 'enrolled' ? codeOf(e) : null)
    .find(Boolean) ?? null

  return {
    completed_codes,
    current_code,
    is_donor: Boolean((memberRes.data as { is_donor?: boolean } | null)?.is_donor),
    is_server: (volRes.data ?? []).length > 0,
    charla_count: (chkRes.data ?? []).length,
    invited_codes: invitedCodes,
  }
}

export type MemberStudyEligibility = {
  /** Inscripciones activas (para el dropdown de "grupo actual" en reubicación). */
  active_enrollments: Array<{ group_id: string; group_name: string; plan_code: string | null }>
  /** Planes que el miembro puede solicitar: no llevados + prerequisito + compromisos.
   *  `via_exception` = habilitado (total o parcialmente) por una excepción activa. */
  eligible_plans: Array<{ id: string; code: string; name: string; stage: string; via_exception?: boolean }>
  /** Compromisos del miembro (para mensajes de la UI). */
  commitments: { is_donor: boolean; attendance_active: boolean; is_server: boolean }
}

const ELIG_LEVEL_TO_STAGE: Record<string, string> = {
  niveles: 'niveles', etapa_inicial: 'inicial', etapa_intermedia: 'intermedia', campanas: 'campaña',
}

/**
 * Elegibilidad de estudios de UN miembro, centralizada para los modales de
 * solicitud (perfil del miembro y flujo del coordinador).
 *
 * Un plan es solicitable si:
 *  - el miembro no lo llevó (sin inscripción completed ni enrolled), y
 *  - cumple el prerequisito de la cadena (completed del prereq), y
 *  - cumple los compromisos de la etapa: inicial = donador + asistencia activa
 *    (1 check-in/mes, 6 meses); intermedia = + servidor activo.
 */
export async function getEligibleStudiesForMember(memberId: string): Promise<MemberStudyEligibility> {
  const supabase = createAdminClient()

  // Asistencia ventana ESTUDIOS (6 meses): ≥1 check-in de charla por mes.
  const { attendanceMonthsSatisfyCriteria, lastCompleteMonthsKeys, ATTENDANCE_MONTHS_STUDIES } = await import('./members')
  const months = lastCompleteMonthsKeys(ATTENDANCE_MONTHS_STUDIES)
  const oldest = `${months[months.length - 1]}-01` // inicio del mes más viejo (fecha local)

  const [memberRes, enrRes, volRes, chkRes, plansRes] = await Promise.all([
    supabase.from('members').select('is_donor').eq('id', memberId).maybeSingle(),
    supabase
      .from('study_enrollments')
      .select('status, group:study_groups!study_enrollments_group_id_fkey(id, name, plan:study_plans(code)), plan_direct:study_plans!study_enrollments_plan_id_fkey(code)')
      .eq('member_id', memberId),
    supabase.from('volunteers').select('id').eq('member_id', memberId).eq('status', 'active').limit(1),
    supabase
      .from('event_checkins')
      .select('checked_in_at, events!inner(event_type)')
      .eq('member_id', memberId)
      .eq('events.event_type', 'charla')
      .gte('checked_in_at', oldest),
    supabase
      .from('study_plans')
      .select('id, code, name, level, prerequisite_code, requires_invitation')
      .eq('is_active', true)
      .eq('is_curricular', true)
      .not('requires_invitation', 'is', true) // invitation_only no se solicita, se invita (A7)
      .order('code'),
  ])

  const enrollments = (enrRes.data ?? []) as Array<{
    status: string
    group: { id: string; name: string; plan: { code: string | null } | null } | null
    plan_direct: { code: string | null } | null
  }>
  const codeOf = (e: typeof enrollments[number]) => e.group?.plan?.code ?? e.plan_direct?.code ?? null
  const completed = new Set(
    enrollments.filter(e => e.status === 'completed' && codeOf(e)).map(e => codeOf(e)!),
  )
  const enrolledCodes = new Set(
    enrollments.filter(e => e.status === 'enrolled' && codeOf(e)).map(e => codeOf(e)!),
  )
  const active_enrollments = enrollments
    .filter(e => e.status === 'enrolled' && e.group)
    .map(e => ({ group_id: e.group!.id, group_name: e.group!.name, plan_code: e.group!.plan?.code ?? null }))

  // Asistencia activa: criterio único vía helper central (members.ts).
  const monthsWithCharla = new Set(
    ((chkRes.data ?? []) as Array<{ checked_in_at: string }>).map(c => c.checked_in_at.slice(0, 7)),
  )
  const attendance_active = attendanceMonthsSatisfyCriteria(monthsWithCharla, ATTENDANCE_MONTHS_STUDIES)

  const is_donor = Boolean((memberRes.data as { is_donor?: boolean } | null)?.is_donor)
  const is_server = (volRes.data ?? []).length > 0

  // Excepciones de matrícula activas (plan_id → requisitos perdonados).
  const { activeExceptionsByPlanForMember } = await import('./study-exceptions')
  const excByPlan = await activeExceptionsByPlanForMember(memberId)
  const waivedFor = (planId: string) => {
    const w = excByPlan.get(planId)
    return (req: string) => !!w && (w.includes('all') || w.includes(req))
  }

  const meetsStage = (stage: string, waived: (req: string) => boolean): boolean => {
    const donorOk = is_donor || waived('donor')
    const attOk = attendance_active || waived('attendance')
    const serverOk = is_server || waived('server')
    if (stage === 'inicial') return donorOk && attOk
    if (stage === 'intermedia') return donorOk && attOk && serverOk
    if (stage === 'niveles') return attOk // niveles: solo asistencia
    return true // campañas: sin compromisos
  }

  const plans = (plansRes.data ?? []) as Array<{
    id: string; code: string | null; name: string; level: string; prerequisite_code: string | null
  }>
  // Descendientes por estudio: quien completó algo POSTERIOR en la cadena ya
  // pasó por ese estudio (misma regla que el análisis de demanda).
  const childrenOf = new Map<string, string[]>()
  for (const p of plans) {
    if (!p.code || !p.prerequisite_code) continue
    const arr = childrenOf.get(p.prerequisite_code) ?? []
    arr.push(p.code)
    childrenOf.set(p.prerequisite_code, arr)
  }
  const completedDescendantOf = (code: string): boolean => {
    const stack = [code]
    const seen = new Set<string>()
    while (stack.length > 0) {
      for (const child of childrenOf.get(stack.pop()!) ?? []) {
        if (seen.has(child)) continue
        if (completed.has(child)) return true
        seen.add(child)
        stack.push(child)
      }
    }
    return false
  }
  const eligible_plans = plans
    .filter(p => p.code)
    .map(p => ({ ...p, stage: ELIG_LEVEL_TO_STAGE[p.level] ?? p.level }))
    .filter(p => {
      const waived = waivedFor(p.id)
      return (
        !completed.has(p.code!) &&
        !enrolledCodes.has(p.code!) &&
        !completedDescendantOf(p.code!) &&
        (!p.prerequisite_code || completed.has(p.prerequisite_code) || waived('prerequisite')) &&
        meetsStage(p.stage, waived)
      )
    })
    .map(p => ({ id: p.id, code: p.code!, name: p.name, stage: p.stage, via_exception: excByPlan.has(p.id) }))

  return {
    active_enrollments,
    eligible_plans,
    commitments: { is_donor, attendance_active, is_server },
  }
}
