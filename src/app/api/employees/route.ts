import { NextResponse } from 'next/server'
import { getEmployees } from '@/lib/supabase/queries/employees'

export async function GET() {
  try {
    return NextResponse.json(await getEmployees())
  } catch (error) {
    console.error('GET /api/employees:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
