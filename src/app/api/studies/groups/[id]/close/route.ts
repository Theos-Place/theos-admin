import { NextRequest, NextResponse } from 'next/server'
import { closeGroup, type CloseResult } from '@/lib/supabase/queries/studies'

// POST: cierra el grupo. Body: { results: CloseResult[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { results } = (await req.json()) as { results: CloseResult[] }
    await closeGroup(id, results ?? [])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/studies/groups/[id]/close:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
