import { NextRequest, NextResponse } from 'next/server'
import { importDonations, type DonationRow } from '@/lib/supabase/queries/finance'

// POST: importa un lote de donaciones. Body: { filename, rows: DonationRow[] }
export async function POST(req: NextRequest) {
  try {
    const { filename, rows } = (await req.json()) as { filename: string; rows: DonationRow[] }
    const batch = await importDonations(filename, rows ?? [])
    return NextResponse.json(batch, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/donations/import:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
