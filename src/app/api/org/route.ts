import { NextResponse } from 'next/server'
import { getOrgCatalog } from '@/lib/supabase/queries/org'

export async function GET() {
  try {
    return NextResponse.json(await getOrgCatalog())
  } catch (error) {
    console.error('GET /api/org:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
