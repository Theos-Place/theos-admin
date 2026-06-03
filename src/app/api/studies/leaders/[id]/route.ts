import { NextRequest, NextResponse } from 'next/server'
import { updateLeader, type LeaderWriteInput } from '@/lib/supabase/queries/studies'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await updateLeader(id, (await req.json()) as Partial<LeaderWriteInput>)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/studies/leaders/[id]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
