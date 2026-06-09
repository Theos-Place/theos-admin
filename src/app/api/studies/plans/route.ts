import { NextRequest, NextResponse } from 'next/server'
import { getStudyPlans, createPlan, type PlanWriteInput } from '@/lib/supabase/queries/studies'

export async function GET() {
  try {
    const plans = await getStudyPlans()
    return NextResponse.json(plans)
  } catch (error) {
    console.error('GET /api/studies/plans:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PlanWriteInput
    const plan = await createPlan(body)
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/plans:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
