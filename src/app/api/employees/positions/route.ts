import { NextResponse } from 'next/server'
import { getPaidPositions } from '@/lib/supabase/queries/employees'

export async function GET() {
  try {
    return NextResponse.json(await getPaidPositions())
  } catch (error) {
    console.error('GET /api/employees/positions:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
