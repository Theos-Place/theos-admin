import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getDonations, getDonationStats, type DonationFilters } from '@/lib/supabase/queries/finance'

// GET: donaciones paginadas con filtros server-side.
//  ?stats=1 → solo los totales (RPC donation_stats).
//  Montos SOLO para rol finanzas (decisión 2026-06-11): admin/dirección ven
//  filas y totales de monto en null.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('finanzas')
    if (auth.res) return auth.res
    const stripAmounts = !auth.ctx.roles.includes('finanzas')
    const { searchParams } = req.nextUrl

    if (searchParams.get('stats') === '1') {
      const stats = await getDonationStats()
      return NextResponse.json(
        stripAmounts ? { ...stats, total_this_month: null, unidentified_total: null } : stats,
      )
    }

    const status = searchParams.get('status')
    const filters: DonationFilters = {
      search: searchParams.get('search') ?? undefined,
      status: status === 'identified' || status === 'unidentified' ? status : 'all',
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 50),
      all: searchParams.get('all') === '1',
    }
    const { rows, total } = await getDonations(filters)
    return NextResponse.json({
      donations: stripAmounts ? rows.map(d => ({ ...d, amount: null })) : rows,
      total,
    })
  } catch (error) {
    console.error('GET /api/finance/donations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
