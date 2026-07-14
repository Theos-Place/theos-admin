import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { countActivePositionVolunteers } from '@/lib/supabase/queries/servers'

// GET: conteo de servidores activos del puesto, para el ActiveWarningModal
// antes de confirmar. Reemplaza el viejo modo `DELETE ?check=1` (un retry sin
// el query param borraba de verdad). Mismo guard que el DELETE.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...SERVICE_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    return NextResponse.json({ activeVolunteers: await countActivePositionVolunteers(id) })
  } catch (error) {
    console.error('GET /api/servers/positions/[id]/usage:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
