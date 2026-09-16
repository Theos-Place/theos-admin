import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getOrgCatalog } from '@/lib/supabase/queries/org'
import { reportarError } from '@/lib/observabilidad'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getOrgCatalog())
  } catch (error) {
    reportarError('GET /api/org:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
