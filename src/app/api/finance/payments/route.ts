import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import {
  getPayments, getPaymentsPage, getPaymentStats, createPayment, type PaymentWriteInput,
} from '@/lib/supabase/queries/finance'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('finanzas')
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl

    // ?stats=1 → totales globales (los 4 montos del header).
    if (searchParams.get('stats') === '1') {
      return NextResponse.json(await getPaymentStats())
    }

    const rawPage = searchParams.get('page')
    const rawPageSize = searchParams.get('pageSize')
    const search = searchParams.get('search') ?? undefined
    const entity = searchParams.get('entity_type')
    const method = searchParams.get('method')
    const status = searchParams.get('status')
    const hasFilter = !!(search || entity || method || status)

    // Sin paginación ni filtros: array completo (back-compat: dashboard, etc.).
    if (rawPage === null && rawPageSize === null && !hasFilter) {
      return NextResponse.json(await getPayments())
    }

    const { rows, total } = await getPaymentsPage({
      search,
      entity_type: entity === 'event' || entity === 'study_group' ? entity : undefined,
      method: method ?? undefined,
      status: status ?? undefined,
      page: Math.max(1, Math.trunc(Number(rawPage ?? 1) || 1)),
      pageSize: Math.min(200, Math.max(1, Math.trunc(Number(rawPageSize ?? 50) || 50))),
    })
    return NextResponse.json({ payments: rows, total })
  } catch (error) {
    console.error('GET /api/finance/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('finanzas', 'direccion')
    if (auth.res) return auth.res
  try {
    const payment = await createPayment((await req.json()) as PaymentWriteInput)
    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error('POST /api/finance/payments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
