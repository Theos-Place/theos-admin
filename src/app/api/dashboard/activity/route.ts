import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getRecentActivity } from '@/lib/supabase/queries/dashboard'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getRecentActivity())
  } catch (error) {
    console.error('GET /api/dashboard/activity:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
