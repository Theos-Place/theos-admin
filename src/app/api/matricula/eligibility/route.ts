import { NextRequest, NextResponse } from 'next/server'
import { getStudyPlans, getStudyGroups, getMemberStudyProfile } from '@/lib/supabase/queries/studies'
import { toDomainStudyType, toDomainStudyGroup } from '@/lib/studies/adapter'
import { computeEligibility } from '@/lib/studies/eligibility'

// GET /api/matricula/eligibility?member_id=X
// Devuelve { eligibility: EligibilityResult[], profile } calculado con datos reales.
export async function GET(req: NextRequest) {
  try {
    const memberId = req.nextUrl.searchParams.get('member_id')
    if (!memberId) {
      return NextResponse.json({ error: 'Se requiere member_id' }, { status: 400 })
    }
    const [plans, groups, profile] = await Promise.all([
      getStudyPlans(),
      getStudyGroups(),
      getMemberStudyProfile(memberId),
    ])
    const eligibility = computeEligibility(
      // Los estudios archivados no se ofrecen en matrícula.
      plans.map(toDomainStudyType).filter(p => !p.is_archived),
      groups.map(toDomainStudyGroup),
      profile,
    )
    return NextResponse.json({ eligibility, profile })
  } catch (error) {
    console.error('GET /api/matricula/eligibility:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
