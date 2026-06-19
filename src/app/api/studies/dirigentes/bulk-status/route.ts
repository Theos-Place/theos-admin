import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { bulkSetDirigenteActive, membersWithActiveGroups } from '@/lib/supabase/queries/studies'

// POST /api/studies/dirigentes/bulk-status → cambio de estado masivo.
// Body: { member_ids: string[], active: boolean }
// Al DESACTIVAR, omite a los que tienen grupo en curso/abierto y los devuelve en
// `skipped` (no se permite dejar inactivo a quien está dando un grupo).
export async function POST(req: NextRequest) {
  const auth = await requireRoles('admin', 'coordinador_dirigentes', 'coordinador_estudios')
  if (auth.res) return auth.res
  try {
    const body = await req.json() as { member_ids?: string[]; active?: boolean }
    const ids = Array.isArray(body.member_ids) ? body.member_ids.filter(x => typeof x === 'string') : []
    if (ids.length === 0 || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'Se requieren member_ids y active' }, { status: 400 })
    }
    let toApply = ids
    let skipped: string[] = []
    if (!body.active) {
      const blocked = await membersWithActiveGroups(ids)
      skipped = ids.filter(id => blocked.has(id))
      toApply = ids.filter(id => !blocked.has(id))
    }
    const updated = toApply.length ? await bulkSetDirigenteActive(toApply, body.active) : 0
    return NextResponse.json({ ok: true, updated, skipped })
  } catch (error) {
    console.error('POST /api/studies/dirigentes/bulk-status:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
