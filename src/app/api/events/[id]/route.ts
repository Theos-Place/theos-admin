import { NextRequest, NextResponse } from 'next/server'
import { getEventById } from '@/lib/supabase/queries/events'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const event = await getEventById(id)
    if (!event) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }
    return NextResponse.json(event)
  } catch (error) {
    console.error('GET /api/events/[id]:', error)
    const detail = error instanceof Error
      ? { message: error.message, ...(error as unknown as Record<string, unknown>) }
      : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
