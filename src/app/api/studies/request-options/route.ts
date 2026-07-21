import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStudyPlans, getStudyGroups, getMemberStudyProfile } from '@/lib/supabase/queries/studies'
import { hasOpenStudyInterest } from '@/lib/supabase/queries/study-requests'
import { activeExceptionsByCodeForMember } from '@/lib/supabase/queries/study-exceptions'
import { toDomainStudyType, toDomainStudyGroup } from '@/lib/studies/adapter'
import { computeEligibility } from '@/lib/studies/eligibility'

// GET /api/studies/request-options?member_id=X
// Opciones para el dropdown de "solicitar estudio": TODOS los estudios que el
// miembro NO ha llevado (ni completado ni en curso), con su elegibilidad y, si
// no es elegible, qué le falta (reasons_blocked). La solicitud es informativa
// (mide demanda), por eso se muestran también los no-elegibles.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId || !isUuid(memberId)) {
      return NextResponse.json({ error: 'Se requiere member_id válido' }, { status: 400 })
    }
    if (memberId !== auth.ctx.memberId) {
      const estudios = await requireModuleView('estudios', { beyondOwn: true })
      if (estudios.res) {
        const miembros = await requireModuleView('miembros', { beyondOwn: true })
        if (miembros.res) return miembros.res
      }
    }

    const [plans, groups, profile, exceptions] = await Promise.all([
      getStudyPlans(), getStudyGroups(), getMemberStudyProfile(memberId), activeExceptionsByCodeForMember(memberId),
    ])
    const eligibility = computeEligibility(
      plans.map(toDomainStudyType).filter(p => !p.is_archived && p.is_curricular !== false),
      groups.data.map(toDomainStudyGroup),
      { ...profile, exceptions },
    )

    // Códigos ya llevados (completados + en curso) — se excluyen del dropdown.
    // Resolución de código vía grupo o histórico plan_direct (misma lógica del sistema).
    const admin = createAdminClient()
    const { data: enr } = await admin
      .from('study_enrollments')
      .select('status, study_groups!study_enrollments_group_id_fkey(plan:study_plans(code)), plan_direct:study_plans!study_enrollments_plan_id_fkey(code)')
      .eq('member_id', memberId)
      .in('status', ['completed', 'enrolled', 'pendiente_de_pago'])
    const taken = new Set<string>()
    for (const e of (enr ?? []) as Array<{ study_groups: { plan: { code: string | null } | null } | null; plan_direct: { code: string | null } | null }>) {
      const code = e.study_groups?.plan?.code ?? e.plan_direct?.code
      if (code) taken.add(code)
    }

    // code → plan_id (el POST de solicitud usa el uuid del plan).
    const idByCode = new Map<string, string>()
    for (const p of plans) if (p.code) idByCode.set(p.code, p.id)

    const options = eligibility
      .filter(e => !taken.has(e.study_code))
      .map(e => ({
        plan_id: idByCode.get(e.study_code) ?? null,
        code: e.study_code,
        name: e.study_name,
        stage: e.stage,
        is_eligible: e.is_eligible,
        missing: e.reasons_blocked,
      }))
      .filter(o => o.plan_id)
    const hasOpen = await hasOpenStudyInterest(memberId)
    return NextResponse.json({ options, has_open_request: hasOpen })
  } catch (error) {
    console.error('GET /api/studies/request-options:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
