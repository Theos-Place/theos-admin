import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getEvents, createEvent } from '@/lib/supabase/queries/events'
import { formToWriteInput, formToSubEvents, formToOrganizingCommittees } from '@/lib/events/form-mapper'
import type { EventType, EventStatus } from '@/types/event'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireModuleView('eventos')
    if (auth.res) return auth.res
    const { searchParams } = req.nextUrl
    const search     = searchParams.get('search')     ?? undefined
    const event_type = searchParams.get('event_type') ?? undefined
    const status     = searchParams.get('status')     ?? undefined
    const is_active  = searchParams.get('is_active')
    // Clamp (como /api/members): NaN o valores fuera de rango rompen .range().
    const rawPage     = Number(searchParams.get('page') ?? 1)
    const rawPageSize = Number(searchParams.get('pageSize') ?? 100)
    const page     = Number.isFinite(rawPage)     ? Math.max(1, Math.trunc(rawPage)) : 1
    const pageSize = Number.isFinite(rawPageSize) ? Math.min(1000, Math.max(1, Math.trunc(rawPageSize))) : 100

    const result = await getEvents({
      search,
      event_type: event_type as EventType | undefined,
      status:     status as EventStatus | undefined,
      is_active:  is_active === 'all' ? 'all' : is_active !== null ? is_active === 'true' : true,
      light:      searchParams.get('light') === '1',
      page,
      pageSize,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/events:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones')
    if (auth.res) return auth.res
    const body = await req.json()
    const event = await createEvent(formToWriteInput(body), formToSubEvents(body), auth.ctx.userId, formToOrganizingCommittees(body))
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('POST /api/events:', error)
    // Propaga el mensaje real (ej. FK de event_type, columna faltante) para que
    // el formulario lo muestre en vez de redirigir como si hubiera guardado.
    const msg = (error as { message?: string })?.message ?? 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
