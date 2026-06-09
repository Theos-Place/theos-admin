import { NextRequest, NextResponse } from 'next/server'
import { getMembers } from '@/lib/supabase/queries/members'

// POST: trae los miembros de un conjunto de IDs (p. ej. integrantes de una lista guardada).
// Body: { ids: string[] }
export async function POST(req: NextRequest) {
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
