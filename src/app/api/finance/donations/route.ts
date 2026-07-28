import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getDonations, getDonationStats, getDonationsFilteredSum, type DonationFilters } from '@/lib/supabase/queries/finance'

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
    // FIN-1: ?with_sum=1 → suma de montos del filtro COMPLETO (server-side,
    // no solo la página). El cliente lo pide solo con filtros activos.
    const withSum = searchParams.get('with_sum') === '1'
    const [{ rows, total }, sum] = await Promise.all([
      getDonations(filters),
      withSum ? getDonationsFilteredSum(filters) : Promise.resolve(null),
    ])
    return NextResponse.json({
      donations: stripAmounts ? rows.map(d => ({ ...d, amount: null })) : rows,
      total,
      filtered_sum: withSum && !stripAmounts ? sum : null,
    })
  } catch (error) {
    console.error('GET /api/finance/donations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
