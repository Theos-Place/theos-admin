import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { getServiceCoordinators } from '@/lib/supabase/queries/servers'

// GET: coordinadores de servidores activos (candidatos para asignar aplicaciones).
export async function GET() {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    return NextResponse.json(await getServiceCoordinators())
  } catch (error) {
    console.error('GET /api/servers/applications/assignees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
