import { NextRequest, NextResponse } from 'next/server'
import { updateEventType } from '@/lib/supabase/queries/events'

// PATCH: actualiza un tipo. Body: campos parciales { name?, color?, icon?, description?, is_active? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ typeId: string }> },
) {
  try {
    const { typeId } = await params
    const body = await req.json()
    const res = await updateEventType(typeId, body)
    return NextResponse.json(res)
  } catch (error) {
    console.error('PATCH /api/events/types/[typeId]:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
