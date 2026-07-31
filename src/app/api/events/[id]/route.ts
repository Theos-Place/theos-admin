import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { hasModulePermission } from '@/lib/auth/roles'
import { canSeeEventManagementData } from '@/lib/events/detail-access'
import {
  getEventById, updateEventScoped, deleteEventScoped, cancelEvent,
  EventHasAttendanceError, type EventScope, type OccurrenceRef,
} from '@/lib/supabase/queries/events'
import { formToPartialWriteInput, formToSubEvents, formToOrganizingCommittees } from '@/lib/events/form-mapper'

/** Lee el alcance (all/future/single) y la ocurrencia del body, si vienen.
 *  `occurrence_date` = YYYY-MM-DD en hora CR (lo calcula el cliente). */
function readScope(body: Record<string, unknown>): { scope: EventScope; occurrence: OccurrenceRef | null } {
  const scope = (['all', 'future', 'single'].includes(body?.scope as string) ? body.scope : 'all') as EventScope
  const date = typeof body?.occurrence_date === 'string' ? body.occurrence_date : null
  const start = typeof body?.occurrence_start === 'string' ? body.occurrence_start : null
  return { scope, occurrence: date && start ? { date, start } : null }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    const event = await getEventById(id)
    if (!event) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }
    // La INFORMACIÓN GENERAL del evento la ve cualquier sesión (decisión
    // 2026-07-31), pero los datos de gestión NO viajan a quien no gestiona:
    // `registrations` y `checkins` traen nombres de personas inscritas.
    const perms = {
      canManage: hasModulePermission(auth.ctx.roles, 'eventos', 'create'),
      canCheckin: hasModulePermission(auth.ctx.roles, 'eventos', 'edit'),
      canReport: hasModulePermission(auth.ctx.roles, 'eventos', 'export'),
    }
    if (!canSeeEventManagementData(perms)) {
      return NextResponse.json({ ...event, registrations: [], checkins: [], volunteers: [] })
    }
    return NextResponse.json(event)
  } catch (error) {
    console.error('GET /api/events/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = await req.json()
    const { scope, occurrence } = readScope(body)
    // Solo reemplazamos sub-eventos si el body los trae explícitamente.
    const subEvents = 'sub_events' in body ? formToSubEvents(body) : undefined
    const committees = 'organizing_committee_ids' in body ? formToOrganizingCommittees(body) : undefined
    const event = await updateEventScoped(id, scope, formToPartialWriteInput(body), subEvents, occurrence, auth.ctx.userId, committees)
    return NextResponse.json(event)
  } catch (error) {
    // Solo los errores de dominio conocidos exponen su mensaje al cliente;
    // cualquier otro error interno no debe filtrar detalles (SQL, stack, etc.).
    if (error instanceof EventHasAttendanceError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('PUT /api/events/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH: cancelar evento. Body: { action: 'cancel', reason }.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = await req.json()
    if (body?.action !== 'cancel') return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
    await cancelEvent(id, typeof body.reason === 'string' ? body.reason : '')
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/events/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: elimina el evento. Body opcional: { scope, occurrence_date, occurrence_start }.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { scope, occurrence } = readScope(body)
    await deleteEventScoped(id, scope, occurrence)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof EventHasAttendanceError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('DELETE /api/events/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
