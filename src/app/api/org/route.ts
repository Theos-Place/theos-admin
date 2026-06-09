import { NextResponse } from 'next/server'
import { getOrgCatalog } from '@/lib/supabase/queries/org'

export async function GET() {
  try {
    return NextResponse.json(await getOrgCatalog())
  } catch (error) {
    console.error('GET /api/org:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
