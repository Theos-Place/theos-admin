import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { updatePlan, type PlanWriteInput } from '@/lib/supabase/queries/studies'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles(...STUDY_ADMIN_ROLES)
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const patch = (await req.json()) as Partial<PlanWriteInput>
    const plan = await updatePlan(id, patch)
    return NextResponse.json(plan)
  } catch (error) {
    console.error('PUT /api/studies/plans/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
