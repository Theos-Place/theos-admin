import { NextRequest, NextResponse } from 'next/server'
import { getFormResponses } from '@/lib/supabase/queries/forms'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    return NextResponse.json(await getFormResponses(id))
  } catch (error) {
    console.error('GET /api/forms/[id]/responses:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
