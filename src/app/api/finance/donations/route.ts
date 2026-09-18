import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import {
  getDonations, getDonationStats, getDonationsFilteredSum, crearDonacionAMano,
  miembroActivoExiste, type DonationFilters,
} from '@/lib/supabase/queries/finance'
import { normalizarDonacion, MENSAJES } from '@/lib/finance/donacion-a-mano'
import { todayCR } from '@/lib/format'
import { reportarError } from '@/lib/observabilidad'

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
    reportarError('GET /api/finance/donations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DON-2 · POST: registra UNA donación a mano.
 *
 * Mismo rol que el import de donaciones ('finanzas', 'direccion'): quien puede
 * cargar un archivo entero puede cargar una fila. No se usa el módulo a secas
 * porque `finanzas:view` lo tienen también admin y dirección solo para MIRAR —
 * los montos ya se les ocultan en el GET de arriba.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRoles('finanzas', 'direccion')
  if (auth.res) return auth.res
  try {
    const body = await req.json().catch(() => null)
    const r = // todayCR: la fecha CIVIL de acá. Con la de UTC, una donación cargada un
    // martes a las 7 p.m. se rechazaría por "futura".
    normalizarDonacion(body ?? {}, todayCR())
    if (!r.ok) return NextResponse.json({ error: MENSAJES[r.motivo], code: r.motivo }, { status: 400 })

    // La ficha se comprueba ACÁ y no solo en la pantalla: una donación colgada
    // de una ficha dada de baja queda fuera de todo reporte.
    if (!(await miembroActivoExiste(r.datos.member_id))) {
      return NextResponse.json(
        { error: 'Esa persona no existe o está dada de baja.', code: 'sin_persona' },
        { status: 400 },
      )
    }
    const creada = await crearDonacionAMano({ ...r.datos, created_by: auth.ctx.userId })
    return NextResponse.json(creada, { status: 201 })
  } catch (error) {
    reportarError('POST /api/finance/donations:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
