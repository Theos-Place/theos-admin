import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getStudyPlans, createPlan, type PlanWriteInput } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    const plans = await getStudyPlans()
    return NextResponse.json(plans)
  } catch (error) {
    console.error('GET /api/studies/plans:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const body = (await req.json()) as PlanWriteInput
    const plan = await createPlan(body)
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/plans:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
