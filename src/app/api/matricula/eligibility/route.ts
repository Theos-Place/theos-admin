import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getStudyPlans, getStudyGroups, getMemberStudyProfile } from '@/lib/supabase/queries/studies'
import { activeExceptionsByCodeForMember } from '@/lib/supabase/queries/study-exceptions'
import { toDomainStudyType, toDomainStudyGroup } from '@/lib/studies/adapter'
import { computeEligibility } from '@/lib/studies/eligibility'
import { meetsPrematRequirementFromCodes } from '@/lib/studies/premat-requirement'
import { todayCR } from '@/lib/format'
import { getBlockingStudyDebt } from '@/lib/supabase/queries/payments'
import { passedRestrictedGroupIds } from '@/lib/supabase/queries/group-restrictions'

// GET /api/matricula/eligibility?member_id=X
// Devuelve { eligibility: EligibilityResult[], profile } calculado con datos reales.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId || !isUuid(memberId)) {
      return NextResponse.json({ error: 'Se requiere member_id válido' }, { status: 400 })
    }
    // El propio perfil siempre; el de OTRO miembro exige módulo estudios o
    // padrón (el perfil devuelve is_donor, edad e historial académico).
    if (memberId !== auth.ctx.memberId) {
      const estudios = await requireModuleView('estudios', { beyondOwn: true })
      if (estudios.res) {
        const miembros = await requireModuleView('miembros', { beyondOwn: true })
        if (miembros.res) return miembros.res
      }
    }
    const [plans, groups, profile, exceptions, blocking_debt] = await Promise.all([
      getStudyPlans(),
      getStudyGroups(),
      getMemberStudyProfile(memberId),
      activeExceptionsByCodeForMember(memberId),
      // PAG-2: la deuda entra al MISMO cálculo que arma la lista, no como un
      // aviso aparte. Así la pantalla no ofrece lo que el servidor rechaza.
      getBlockingStudyDebt(memberId),
    ])
    // GRU-2: qué grupos RESTRINGIDOS cumple esta persona. Se resuelve acá (una
    // vez por restricción distinta) y entra a la función pura como dato.
    const passedRestrictedGroups = await passedRestrictedGroupIds(memberId, groups.data)
    const eligibility = computeEligibility(
      // Ni archivados ni charlas no curriculares (ej. BUS) se ofrecen en matrícula.
      plans.map(toDomainStudyType).filter(p => !p.is_archived && p.is_curricular !== false),
      groups.data.map(toDomainStudyGroup),
      { ...profile, exceptions, blocking_debt },
      { todayYmd: todayCR(), passedRestrictedGroups }, // GRU-1 ventana + GRU-2 restricción
    )
    // PRE-5: ¿puede entrar al curso prematrimonial? (N1 completado + inscrito
    // en N2). La página de matrícula usa este flag para mostrar/ocultar la
    // tarjeta del wizard; el POST del prematrimonial re-valida server-side.
    const premat_ok = meetsPrematRequirementFromCodes(profile?.completed_codes ?? [], profile?.enrolled_codes ?? [])
    // PRE-6: plan_id de PREMAT para la solicitud de beca del wizard (el modal
    // de becas apunta a un study_plan por uuid).
    const premat_plan_id = plans.find(p => (p as { code?: string | null }).code === 'PREMAT')?.id ?? null
    return NextResponse.json({
      eligibility, profile, premat_ok, premat_plan_id,
      blocking_debt,
      // Se mantiene por compatibilidad con lo que ya lee la pantalla.
      pending_study_payments: blocking_debt.count,
    })
  } catch (error) {
    console.error('GET /api/matricula/eligibility:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
