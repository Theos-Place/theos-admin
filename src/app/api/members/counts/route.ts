import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getMemberCounts } from '@/lib/supabase/queries/members'

// GET: conteos para los chips/header (total, donadores, servidores, activos_asistencia).
export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getMemberCounts())
  } catch (error) {
    console.error('GET /api/members/counts:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
