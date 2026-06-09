import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createServicePosition } from '@/lib/supabase/queries/servers'

// POST: crea un puesto (service_position). Body: { area_id, title, description?, max_volunteers? }
export async function POST(req: NextRequest) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    const pos = await createServicePosition(await req.json())
    return NextResponse.json(pos, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/positions:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
