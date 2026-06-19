import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { bulkUpdateLeaderStudies } from '@/lib/supabase/queries/studies'

// POST /api/studies/dirigentes/bulk-studies → agrega/quita un estudio a la
// formación o disponibilidad de varios dirigentes.
// Body: { member_ids: string[], field: 'formation'|'availability', codes: string[], action: 'add'|'remove' }
// `codes` puede traer varios (un grupo "Niveles"/"Discípulos" expande a sus códigos).
export async function POST(req: NextRequest) {
  const auth = await requireRoles('admin', 'direccion', 'coordinador_dirigentes', 'coordinador_estudios')
  if (auth.res) return auth.res
  try {
    const body = await req.json() as { member_ids?: string[]; field?: string; codes?: string[]; action?: string }
    const ids = Array.isArray(body.member_ids) ? body.member_ids.filter(x => typeof x === 'string') : []
    const field = body.field === 'formation' || body.field === 'availability' ? body.field : null
    const action = body.action === 'add' || body.action === 'remove' ? body.action : null
    const codes = Array.isArray(body.codes) ? body.codes.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim()) : []
    if (ids.length === 0 || !field || !action || codes.length === 0) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }
    const updated = await bulkUpdateLeaderStudies(ids, field, codes, action)
    return NextResponse.json({ ok: true, updated })
  } catch (error) {
    console.error('POST /api/studies/dirigentes/bulk-studies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
