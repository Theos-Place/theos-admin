import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getAssignableFinanceMembers } from '@/lib/supabase/queries/finance-requests'
import { reportarError } from '@/lib/observabilidad'

// GET: miembros con rol finanzas activo, asignables a una solicitud.
export async function GET() {
  const auth = await requireRoles('finanzas')
  if (auth.res) return auth.res
  try {
    return NextResponse.json(await getAssignableFinanceMembers())
  } catch (error) {
    reportarError('GET /api/finance/requests/assignees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
