import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { REQUEST_COORDINATOR_ROLES } from '@/lib/studies/request-assignment'
import { getAssignableForRequests } from '@/lib/supabase/queries/study-requests'

// GET: a quién se le puede asignar una solicitud — coordinadores de estudios /
// dirigentes MÁS los miembros con puesto activo en el comité de estudios
// bíblicos (decisión 2026-07-31). Solo quien puede asignar ve la lista.
export async function GET() {
  const auth = await requireRoles(...REQUEST_COORDINATOR_ROLES)
  if (auth.res) return auth.res
  try {
    return NextResponse.json(await getAssignableForRequests())
  } catch (error) {
    console.error('GET /api/studies/requests/assignees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
