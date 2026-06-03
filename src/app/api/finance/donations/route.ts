import { NextResponse } from 'next/server'
import { getDonations } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    return NextResponse.json(await getDonations())
  } catch (error) {
    console.error('GET /api/finance/donations:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
