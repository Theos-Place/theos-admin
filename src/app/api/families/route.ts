import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createFamily } from '@/lib/supabase/queries/members'

// POST: crea una familia. Body: { name, members: [{ member_id, relation }] }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles('editor_perfiles', 'direccion', 'encargado_staff', 'coordinador_estudios')
    if (auth.res) return auth.res
    const body = await req.json()
    if (!body?.name || !Array.isArray(body?.members) || body.members.length === 0) {
      return NextResponse.json({ error: 'Se requiere name y al menos un integrante' }, { status: 400 })
    }
    const res = await createFamily({ name: body.name, members: body.members })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    console.error('POST /api/families:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
