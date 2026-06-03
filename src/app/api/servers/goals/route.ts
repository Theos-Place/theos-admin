import { NextResponse } from 'next/server'
import { getCommitteeGoals } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
    return NextResponse.json(await getCommitteeGoals())
  } catch (error) {
    console.error('GET /api/servers/goals:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
