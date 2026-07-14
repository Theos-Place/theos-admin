import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { getStudyPlans, createPlan } from '@/lib/supabase/queries/studies'
import { planWriteSchema } from './schema'

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
    const auth = await requireRoles(...STUDY_ADMIN_ROLES)
    if (auth.res) return auth.res
  try {
    const parsed = planWriteSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const plan = await createPlan(parsed.data)
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/plans:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
