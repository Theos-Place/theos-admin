import { NextResponse } from 'next/server'
import { getRefunds } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    return NextResponse.json(await getRefunds())
  } catch (error) {
    console.error('GET /api/finance/refunds:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
