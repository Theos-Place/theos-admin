import { NextResponse } from 'next/server'
import { getRecentActivity } from '@/lib/supabase/queries/dashboard'

export async function GET() {
  try {
    return NextResponse.json(await getRecentActivity())
  } catch (error) {
    console.error('GET /api/dashboard/activity:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
