import { NextRequest, NextResponse } from 'next/server'
import { getPaidPositions, createPosition, type PositionWriteInput } from '@/lib/supabase/queries/employees'

export async function GET() {
  try {
    return NextResponse.json(await getPaidPositions())
  } catch (error) {
    console.error('GET /api/employees/positions:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const p = await createPosition((await req.json()) as PositionWriteInput)
    return NextResponse.json(p, { status: 201 })
  } catch (error) {
    console.error('POST /api/employees/positions:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
