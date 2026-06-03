import { NextResponse } from 'next/server'
import { getApplications } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
    return NextResponse.json(await getApplications())
  } catch (error) {
    console.error('GET /api/servers/applications:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
