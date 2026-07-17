import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMembersByIds } from '@/lib/supabase/queries/members'

// POST: trae los miembros de un conjunto de IDs (p. ej. integrantes de una lista guardada).
// Body: { ids: string[] }
export async function POST(req: NextRequest) {
    const auth = await requireRoles('editor_perfiles', 'direccion', 'encargado_staff', 'coordinador_estudios', 'comunicaciones')
    if (auth.res) return auth.res
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids)) return NextResponse.json({ error: 'Se requiere ids[]' }, { status: 400 })
    if (ids.length === 0) return NextResponse.json({ members: [], total: 0 })
    // QA 2026-07-17: getMembersByIds trocea en chunks de 100 — un solo
    // .in('id', ids) con una lista grande reventaba por URL gigante (mismo
    // antecedente del 500 en filtros).
    const members = await getMembersByIds(ids)
    return NextResponse.json({ members, total: members.length })
  } catch (error) {
    console.error('POST /api/members/by-ids:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
