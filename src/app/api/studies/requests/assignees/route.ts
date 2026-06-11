import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getEligibleCoordinators } from '@/lib/supabase/queries/study-requests'

// GET: coordinadores de dirigentes activos, asignables a una solicitud.
export async function GET() {
  const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes')
  if (auth.res) return auth.res
  try {
    const all = await getEligibleCoordinators()
    return NextResponse.json(all.filter(c => c.roles.includes('coordinador_dirigentes')))
  } catch (error) {
    console.error('GET /api/studies/requests/assignees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
