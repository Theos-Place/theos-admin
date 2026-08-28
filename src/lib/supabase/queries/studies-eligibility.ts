// Perfil académico y elegibilidad de matrícula de un miembro. Extraído de
// studies.ts (auditoría 2026-06: archivos gigantes). Re-exportado por studies.ts.
import { createAdminClient } from '@/lib/supabase/admin'
import { calcAge } from '@/lib/format'
// Mapa nivel→etapa y compromisos por etapa: fuente única en
// @/lib/studies/eligibility (QA 2026-07-17, antes duplicados acá).
import { LEVEL_TO_STAGE, requirementsForStage } from '@/lib/studies/eligibility'
import { RELOCATION_CODES, puedeReubicarseA } from '@/lib/studies/relocation'

/** Perfil académico de un miembro para calcular elegibilidad de matrícula.
 *  Devuelve los CÓDIGOS de plan (no nombres) y los compromisos reales. */
export async function getMemberStudyProfile(memberId: string): Promise<{
  completed_codes: string[]
  current_code: string | null
  /** Todos los códigos con matrícula 'enrolled' (no solo el primero). */
  enrolled_codes: string[]
  is_donor: boolean
  is_server: boolean
  charla_count: number
  attendance_active: boolean
  /** Criterio reforzado, solo para Etapa Intermedia: el doble de asistencias
   *  (ver ATTENDANCE_MIN_CHARLAS_INTERMEDIA) sobre la MISMA ventana. */
  attendance_active_intermedia: boolean
  invited_codes: string[]
  member_age: number | null
  authorized_virtual_studies: boolean
  /** FIN-2: ¿tiene documento de identidad registrado? La matrícula lo exige. */
  has_document: boolean
}> {
  const supabase = createAdminClient()
  const { attendanceWindowStart, meetsAttendanceCriteria, ATTENDANCE_MIN_CHARLAS_INTERMEDIA } = await import('@/lib/attendance')
  const oldest = attendanceWindowStart()
  const { activeInvitationCodesForMember } = await import('./study-invitations')
  const [memberRes, enrRes, volRes, chkRes, invitedCodes, adminDataRes] = await Promise.all([
    supabase.from('members').select('is_donor, birth_date, cedula').eq('id', memberId).maybeSingle(),
    supabase
      .from('study_enrollments')
      .select('status, study_groups!study_enrollments_group_id_fkey(plan:study_plans(code)), plan_direct:study_plans!study_enrollments_plan_id_fkey(code)')
      .eq('member_id', memberId),
    supabase.from('volunteers').select('id').eq('member_id', memberId).eq('status', 'active').limit(1),
    supabase
      .from('event_checkins')
      .select('checked_in_at, events!inner(event_type)')
      .eq('member_id', memberId)
      .eq('events.event_type', 'charla')
      .gte('checked_in_at', `${oldest}T00:00:00Z`),
    activeInvitationCodesForMember(memberId),
    supabase.from('member_admin_data').select('authorized_virtual_studies').eq('member_id', memberId).maybeSingle(),
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
  // TODOS los códigos con matrícula 'enrolled' (current_code es solo el primero;
  // alguien puede cursar N2 y una capacitación a la vez). Lo usa el requisito
  // prematrimonial (PRE-5: N1 completado + inscrito en N2).
  const enrolled_codes = enrollments
    .filter(e => e.status === 'enrolled' && codeOf(e))
    .map(e => codeOf(e)!)
  const birth = (memberRes.data as { birth_date?: string | null } | null)?.birth_date ?? null
  const charlaDates = ((chkRes.data ?? []) as Array<{ checked_in_at: string | null }>).map(c => c.checked_in_at ?? '')
  return {
    completed_codes,
    current_code,
    enrolled_codes,
    is_donor: Boolean((memberRes.data as { is_donor?: boolean } | null)?.is_donor),
    is_server: (volRes.data ?? []).length > 0,
    charla_count: charlaDates.filter(Boolean).length,
    attendance_active: meetsAttendanceCriteria(charlaDates),
    attendance_active_intermedia: meetsAttendanceCriteria(charlaDates, { minCount: ATTENDANCE_MIN_CHARLAS_INTERMEDIA }),
    invited_codes: invitedCodes,
    member_age: birth ? calcAge(birth) : null,
    authorized_virtual_studies: Boolean((adminDataRes.data as { authorized_virtual_studies?: boolean } | null)?.authorized_virtual_studies),
    has_document: !!String((memberRes.data as { cedula?: string | null } | null)?.cedula ?? '').trim(),
  }
}

export type MemberStudyEligibility = {
  /** Inscripciones activas (para el dropdown de "grupo actual" en reubicación). */
  active_enrollments: Array<{ group_id: string; group_name: string; plan_code: string | null }>
  /** Planes que el miembro puede solicitar: no llevados + prerequisito + compromisos.
   *  `via_exception` = habilitado (total o parcialmente) por una excepción activa. */
  eligible_plans: Array<{ id: string; code: string; name: string; stage: string; via_exception?: boolean }>
  /** Compromisos del miembro (para mensajes de la UI). `attendance_active_intermedia`
   *  es el criterio reforzado que aplica específicamente a Etapa Intermedia. */
  commitments: { is_donor: boolean; attendance_active: boolean; attendance_active_intermedia: boolean; is_server: boolean }
  /** Opciones del dropdown de reubicación con lo que le falta para cada una.
   *  A diferencia de `eligible_plans`, NO excluye los estudios que ya lleva:
   *  reubicarse es justamente volver al que se pausó. */
  relocation_options: Array<{ code: string; name: string; is_eligible: boolean; missing: string[] }>
}

/**
 * Elegibilidad de estudios de UN miembro, centralizada para los modales de
 * solicitud (perfil del miembro y flujo del coordinador).
 *
 * Un plan es solicitable si:
 *  - el miembro no lo llevó (sin inscripción completed ni enrolled), y
 *  - cumple el prerequisito de la cadena (completed del prereq), y
 *  - cumple los compromisos de la etapa (mínimo real, sin exceso):
 *    niveles = ninguno; inicial = asistencia activa (criterio general: ≥6
 *    charlas en 6 meses, con al menos una en 60 días); intermedia = + donador
 *    + servidor activo, con asistencia REFORZADA (≥12 charlas en 6 meses,
 *    misma condición de recencia — ver ATTENDANCE_MIN_CHARLAS_INTERMEDIA);
 *    campañas = ninguno.
 */
export async function getEligibleStudiesForMember(memberId: string): Promise<MemberStudyEligibility> {
  const supabase = createAdminClient()

  // Asistencia: criterio único vía helper central (@/lib/attendance).
  const { attendanceWindowStart, meetsAttendanceCriteria, ATTENDANCE_MIN_CHARLAS_INTERMEDIA } = await import('@/lib/attendance')
  const oldest = attendanceWindowStart()

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
      .gte('checked_in_at', `${oldest}T00:00:00Z`),
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
  // 'pendiente_de_pago' cuenta como cursando: no se puede solicitar un plan
  // cuya matrícula automática ya existe y solo espera el pago.
  //
  // 'en_revision' TAMBIÉN cuenta acá, y es a propósito: no sabemos si esa
  // persona aprobó ese estudio o no — por eso está en revisión. Dejarla pedirlo
  // de nuevo sería resolver la duda por la vía de asumir que no lo llevó, y
  // además abre la puerta a una matrícula duplicada. El estado nuevo cambia lo
  // que se MUESTRA (deja de decir "En curso", deja de pedir el pago), no lo que
  // se permite: eso se destraba cuando el coordinador lo resuelve.
  const enrolledCodes = new Set(
    enrollments
      .filter(e => (e.status === 'enrolled' || e.status === 'pendiente_de_pago' || e.status === 'en_revision') && codeOf(e))
      .map(e => codeOf(e)!),
  )
  const active_enrollments = enrollments
    .filter(e => e.status === 'enrolled' && e.group)
    .map(e => ({ group_id: e.group!.id, group_name: e.group!.name, plan_code: e.group!.plan?.code ?? null }))

  // Asistencia activa: criterio único vía helper central (@/lib/attendance).
  const charlaDates = ((chkRes.data ?? []) as Array<{ checked_in_at: string }>).map(c => c.checked_in_at)
  const attendance_active = meetsAttendanceCriteria(charlaDates)
  // Etapa Intermedia: criterio reforzado (el doble de asistencias), misma ventana.
  const attendance_active_intermedia = meetsAttendanceCriteria(charlaDates, { minCount: ATTENDANCE_MIN_CHARLAS_INTERMEDIA })

  const is_donor = Boolean((memberRes.data as { is_donor?: boolean } | null)?.is_donor)
  const is_server = (volRes.data ?? []).length > 0

  // Excepciones de matrícula activas (plan_id → requisitos perdonados).
  const { activeExceptionsByPlanForMember } = await import('./study-exceptions')
  const excByPlan = await activeExceptionsByPlanForMember(memberId)
  const waivedFor = (planId: string) => {
    const w = excByPlan.get(planId)
    return (req: string) => !!w && (w.includes('all') || w.includes(req))
  }

  // Compromisos por etapa: fuente única (requirementsForStage) para no volver
  // a divergir de la demanda ni del resto del sistema (QA 2026-07-17).
  const meetsStage = (stage: string, waived: (req: string) => boolean): boolean => {
    const req = requirementsForStage(stage)
    if (req.donor && !(is_donor || waived('donor'))) return false
    if (req.server && !(is_server || waived('server'))) return false
    if (req.attendance === 'general' && !(attendance_active || waived('attendance'))) return false
    if (req.attendance === 'intermedia' && !(attendance_active_intermedia || waived('attendance'))) return false
    return true
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
    .map(p => ({ ...p, stage: LEVEL_TO_STAGE[p.level] ?? p.level }))
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
    commitments: { is_donor, attendance_active, attendance_active_intermedia, is_server },
    // Opciones del dropdown de REUBICACIÓN, con lo que le falta a esta persona
    // para cada una. Se calcula acá y no en la pantalla para que la pantalla y
    // la validación del POST usen exactamente el mismo criterio: la misma regla
    // escrita dos veces se separa, y acá el síntoma sería ofrecer una opción que
    // el servidor después rechaza.
    //
    // NO se excluyen los estudios que ya lleva: quien pide reubicación venía en
    // ese estudio y lo pausó. Filtrarlos dejaría el dropdown vacío justo para
    // quien necesita volver.
    relocation_options: RELOCATION_CODES.map(code => {
      const plan = plans.find(p => p.code === code)
      const { is_eligible, missing } = puedeReubicarseA(
        code, plan?.level, { is_donor, is_server, attendance_active, attendance_active_intermedia },
        plan ? waivedFor(plan.id) : undefined,
      )
      return { code, name: plan?.name ?? code, is_eligible, missing }
    }),
  }
}
