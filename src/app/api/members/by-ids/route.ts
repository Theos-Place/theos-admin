import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMembers } from '@/lib/supabase/queries/members'

// POST: trae los miembros de un conjunto de IDs (p. ej. integrantes de una lista guardada).
// Body: { ids: string[] }
export async function POST(req: NextRequest) {
    const auth = await requireRoles('editor_perfiles', 'direccion', 'encargado_staff', 'coordinador_estudios')
    if (auth.res) return auth.res
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids)) return NextResponse.json({ error: 'Se requiere ids[]' }, { status: 400 })
    if (ids.length === 0) return NextResponse.json({ members: [], total: 0 })
    const result = await getMembers({ ids, pageSize: ids.length })
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/members/by-ids:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
