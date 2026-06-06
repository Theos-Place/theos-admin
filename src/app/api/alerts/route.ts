import { NextResponse } from 'next/server'
import { getAlerts } from '@/lib/supabase/queries/alerts'

export async function GET() {
  try {
    return NextResponse.json(await getAlerts())
  } catch (error) {
    console.error('GET /api/alerts:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
