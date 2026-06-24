import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { getSedes, createSede } from '@/lib/supabase/queries/sedes'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getSedes())
  } catch (error) {
    console.error('GET /api/sedes:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: crea una zona/sede por nombre (dedup por nombre normalizado). La usa el
// combobox de zona al guardar un grupo con una zona nueva. Roles de estudios.
export async function POST(req: NextRequest) {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const body = await req.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name : ''
    if (!name.trim()) return NextResponse.json({ error: 'Nombre de zona requerido' }, { status: 400 })
    return NextResponse.json(await createSede(name))
  } catch (error) {
    console.error('POST /api/sedes:', error)
    return NextResponse.json({ error: 'No se pudo crear la zona.' }, { status: 500 })
  }
}
