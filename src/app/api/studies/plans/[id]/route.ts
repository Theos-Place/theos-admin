import { NextRequest, NextResponse } from 'next/server'
import { updatePlan, type PlanWriteInput } from '@/lib/supabase/queries/studies'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const patch = (await req.json()) as Partial<PlanWriteInput>
    const plan = await updatePlan(id, patch)
    return NextResponse.json(plan)
  } catch (error) {
    console.error('PUT /api/studies/plans/[id]:', error)
    const detail = error instanceof Error
      ? { message: error.message, ...(error as unknown as Record<string, unknown>) }
      : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
