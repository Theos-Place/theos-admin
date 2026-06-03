import { NextResponse } from 'next/server'
import { getVacancies } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
    return NextResponse.json(await getVacancies())
  } catch (error) {
    console.error('GET /api/servers/vacancies:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
