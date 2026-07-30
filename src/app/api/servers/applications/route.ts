import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { SERVICE_APPLICATIONS_ROLES } from '@/lib/auth/service-applications'
import {
  getApplications, getApplicationsPage, getApplicationStats, createApplication,
  type ApplicationFilters,
} from '@/lib/supabase/queries/servers'

export async function GET(req: NextRequest) {
  try {
    // La BANDEJA de solicitudes de servicio es solo del coordinador de
    // servidores y admin (2026-07-30). Gestionar UNA aplicación desde el
    // detalle de la vacante sigue con su propio guard (PUT applications/[id]).
    const auth = await requireRoles(...SERVICE_APPLICATIONS_ROLES)
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
