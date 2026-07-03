import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { setFolletoRequestsStatus } from '@/lib/supabase/queries/folletos'
import { isFolletoState } from '@/lib/studies/folletos'

// POST: cambio de estado (individual o en lote). Body: { ids: string[], status }. Módulo 'folletos' (edit).
export async function POST(req: NextRequest) {
  const auth = await requireModuleView('folletos', { action: 'edit' })
  if (auth.res) return auth.res
  try {
    const { ids, status } = (await req.json()) as { ids?: string[]; status?: string }
    const list = Array.isArray(ids) ? ids.filter(Boolean) : []
    if (list.length === 0) return NextResponse.json({ error: 'No hay folletos seleccionados.' }, { status: 400 })
    if (!status || !isFolletoState(status)) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
    const { updated } = await setFolletoRequestsStatus(list, status)
    return NextResponse.json({ ok: true, updated })
  } catch (error) {
    console.error('POST /api/studies/folletos/bulk:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
