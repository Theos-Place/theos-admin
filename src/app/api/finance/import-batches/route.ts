import { NextResponse } from 'next/server'
import { getImportBatches } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    return NextResponse.json(await getImportBatches())
  } catch (error) {
    console.error('GET /api/finance/import-batches:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
