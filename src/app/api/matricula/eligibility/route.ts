import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validate'
import { getStudyPlans, getStudyGroups, getMemberStudyProfile } from '@/lib/supabase/queries/studies'
import { activeExceptionsByCodeForMember } from '@/lib/supabase/queries/study-exceptions'
import { toDomainStudyType, toDomainStudyGroup } from '@/lib/studies/adapter'
import { computeEligibility } from '@/lib/studies/eligibility'
import { meetsPrematRequirementFromCodes } from '@/lib/studies/premat-requirement'

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
    const [plans, groups, profile, exceptions] = await Promise.all([
      getStudyPlans(),
      getStudyGroups(),
      getMemberStudyProfile(memberId),
      activeExceptionsByCodeForMember(memberId),
    ])
    const eligibility = computeEligibility(
      // Ni archivados ni charlas no curriculares (ej. BUS) se ofrecen en matrícula.
      plans.map(toDomainStudyType).filter(p => !p.is_archived && p.is_curricular !== false),
      groups.data.map(toDomainStudyGroup),
      { ...profile, exceptions },
    )
    // PRE-5: ¿puede entrar al curso prematrimonial? (N1 completado + inscrito
    // en N2). La página de matrícula usa este flag para mostrar/ocultar la
    // tarjeta del wizard; el POST del prematrimonial re-valida server-side.
    const premat_ok = meetsPrematRequirementFromCodes(profile?.completed_codes ?? [], profile?.enrolled_codes ?? [])
    return NextResponse.json({ eligibility, profile, premat_ok })
  } catch (error) {
    console.error('GET /api/matricula/eligibility:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
