import { NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getDonations } from '@/lib/supabase/queries/finance'

export async function GET() {
  try {
    const auth = await requireModuleView('finanzas')
    if (auth.res) return auth.res
    // Montos SOLO para rol finanzas (decisión 2026-06-11): admin/dirección
    // ven las filas con amount null.
    const stripAmounts = !auth.ctx.roles.includes('finanzas')
    const donations = await getDonations()
    return NextResponse.json(
      stripAmounts ? donations.map(d => ({ ...d, amount: null })) : donations,
    )
  } catch (error) {
    console.error('GET /api/finance/donations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
