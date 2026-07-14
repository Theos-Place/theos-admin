import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { updatePlan } from '@/lib/supabase/queries/studies'
import { planUpdateSchema } from '../schema'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles(...STUDY_ADMIN_ROLES)
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = planUpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const plan = await updatePlan(id, parsed.data)
    return NextResponse.json(plan)
  } catch (error) {
    console.error('PUT /api/studies/plans/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
