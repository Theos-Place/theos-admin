import { NextResponse } from 'next/server'
import { getScholarships } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    return NextResponse.json(await getScholarships())
  } catch (error) {
    console.error('GET /api/finance/scholarships:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
