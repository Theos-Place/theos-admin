import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { bulkUpdateLeaderStudies } from '@/lib/supabase/queries/studies'

// POST /api/studies/dirigentes/bulk-studies → agrega/quita un estudio a la
// formación o disponibilidad de varios dirigentes.
// Body: { member_ids: string[], field: 'formation'|'availability', code: string, action: 'add'|'remove' }
export async function POST(req: NextRequest) {
  const auth = await requireRoles('admin', 'coordinador_dirigentes', 'coordinador_estudios')
  if (auth.res) return auth.res
  try {
    const body = await req.json() as { member_ids?: string[]; field?: string; code?: string; action?: string }
    const ids = Array.isArray(body.member_ids) ? body.member_ids.filter(x => typeof x === 'string') : []
    const field = body.field === 'formation' || body.field === 'availability' ? body.field : null
    const action = body.action === 'add' || body.action === 'remove' ? body.action : null
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (ids.length === 0 || !field || !action || !code) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }
    const updated = await bulkUpdateLeaderStudies(ids, field, code, action)
    return NextResponse.json({ ok: true, updated })
  } catch (error) {
    console.error('POST /api/studies/dirigentes/bulk-studies:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
