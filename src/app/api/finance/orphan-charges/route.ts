import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { cobrosHuerfanos } from '@/lib/supabase/queries/finance'
import { reportarError } from '@/lib/observabilidad'

// MAT-3 · Los cobros de estudio que quedaron sin estudio. Solo lectura: lo
// que se hace con cada uno (crédito, devolución, anular) se decide caso por
// caso y pasa por las pantallas que ya existen para eso.
export async function GET() {
  const auth = await requireRoles('admin', 'finanzas', 'direccion')
  if (auth.res) return auth.res
  try {
    const items = await cobrosHuerfanos()
    return NextResponse.json({ items })
  } catch (error) {
    reportarError('GET /api/finance/orphan-charges:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
