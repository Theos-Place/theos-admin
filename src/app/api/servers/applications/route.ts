import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import {
  getApplications, getApplicationsPage, getApplicationStats, createApplication,
  type ApplicationFilters,
} from '@/lib/supabase/queries/servers'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('servidores')
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl

    if (searchParams.get('stats') === '1') {
      return NextResponse.json(await getApplicationStats())
    }

    const rawPage = searchParams.get('page')
    const rawPageSize = searchParams.get('pageSize')
    const search = searchParams.get('search') ?? undefined
    const statusParam = searchParams.get('status')
    const committeeId = searchParams.get('committee') ?? undefined
    const status = (['pending', 'reviewing', 'approved', 'rejected'] as const).find(s => s === statusParam)
    const hasFilter = !!(search || status || committeeId)

    // Sin paginación ni filtros: array completo (back-compat para useServers).
    if (rawPage === null && rawPageSize === null && !hasFilter) {
      return NextResponse.json(await getApplications())
    }

    const filters: ApplicationFilters = {
      search, status, committeeId,
      page: Math.max(1, Math.trunc(Number(rawPage ?? 1) || 1)),
      pageSize: Math.min(200, Math.max(1, Math.trunc(Number(rawPageSize ?? 50) || 50))),
    }
    const { rows, total } = await getApplicationsPage(filters)
    return NextResponse.json({ applications: rows, total })
  } catch (error) {
    console.error('GET /api/servers/applications:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
    const auth = await requireRoles('encargado_staff', 'direccion', 'lider_comite')
    if (auth.res) return auth.res
  try {
    await createApplication(await req.json())
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/applications:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
