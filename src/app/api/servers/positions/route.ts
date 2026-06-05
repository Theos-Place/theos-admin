import { NextRequest, NextResponse } from 'next/server'
import { createServicePosition } from '@/lib/supabase/queries/servers'

// POST: crea un puesto (service_position). Body: { area_id, title, description?, max_volunteers? }
export async function POST(req: NextRequest) {
  try {
    const pos = await createServicePosition(await req.json())
    return NextResponse.json(pos, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/positions:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
