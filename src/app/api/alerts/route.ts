import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getAlerts } from '@/lib/supabase/queries/alerts'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getAlerts())
  } catch (error) {
    console.error('GET /api/alerts:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
