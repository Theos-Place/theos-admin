import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { bulkSetDirigenteActive } from '@/lib/supabase/queries/studies'

// POST /api/studies/dirigentes/bulk-status → cambio de estado masivo.
// Body: { member_ids: string[], active: boolean }
export async function POST(req: NextRequest) {
  const auth = await requireRoles('admin', 'coordinador_dirigentes', 'coordinador_estudios')
  if (auth.res) return auth.res
  try {
    const body = await req.json() as { member_ids?: string[]; active?: boolean }
    const ids = Array.isArray(body.member_ids) ? body.member_ids.filter(x => typeof x === 'string') : []
    if (ids.length === 0 || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'Se requieren member_ids y active' }, { status: 400 })
    }
    const updated = await bulkSetDirigenteActive(ids, body.active)
    return NextResponse.json({ ok: true, updated })
  } catch (error) {
    console.error('POST /api/studies/dirigentes/bulk-status:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
