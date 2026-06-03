import { NextRequest, NextResponse } from 'next/server'
import { updateGroup, type GroupWriteInput } from '@/lib/supabase/queries/studies'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const patch = (await req.json()) as Partial<GroupWriteInput>
    await updateGroup(id, patch)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/studies/groups/[id]:', error)
    const detail = error instanceof Error
      ? { message: error.message, ...(error as unknown as Record<string, unknown>) }
      : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
