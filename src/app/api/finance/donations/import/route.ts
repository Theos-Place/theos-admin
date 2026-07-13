import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { importDonations, type DonationRow } from '@/lib/supabase/queries/finance'

// POST: importa un lote de donaciones.
// Body: { filename, rows: DonationRow[], update_donor_status? }
export async function POST(req: NextRequest) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const { filename, rows, update_donor_status } = (await req.json()) as {
      filename: string; rows: DonationRow[]; update_donor_status?: boolean
    }
    const batch = await importDonations(filename, rows ?? [], { updateDonorStatus: Boolean(update_donor_status) })
    return NextResponse.json(batch, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/donations/import:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
