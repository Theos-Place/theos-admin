import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getImportBatches } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    return NextResponse.json(await getImportBatches())
  } catch (error) {
    console.error('GET /api/finance/import-batches:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
