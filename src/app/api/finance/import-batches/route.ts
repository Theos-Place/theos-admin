import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getImportBatches } from '@/lib/supabase/queries/finance'
import { reportarError } from '@/lib/observabilidad'

export async function GET() {
  try {
    const auth = await requireModuleView('finanzas')
    if (auth.res) return auth.res
    return NextResponse.json(await getImportBatches())
  } catch (error) {
    reportarError('GET /api/finance/import-batches:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
