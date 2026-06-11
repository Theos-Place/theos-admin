import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getAssignableFinanceMembers } from '@/lib/supabase/queries/finance-requests'

// GET: miembros con rol finanzas activo, asignables a una solicitud.
export async function GET() {
  const auth = await requireRoles('finanzas')
  if (auth.res) return auth.res
  try {
    return NextResponse.json(await getAssignableFinanceMembers())
  } catch (error) {
    console.error('GET /api/finance/requests/assignees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
