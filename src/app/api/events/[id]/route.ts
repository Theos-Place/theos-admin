import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getEventById, updateEvent, deleteEvent, cancelEvent } from '@/lib/supabase/queries/events'
import { formToPartialWriteInput, formToSubEvents } from '@/lib/events/form-mapper'

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
    // Solo reemplazamos sub-eventos si el body los trae explícitamente.
    const subEvents = 'sub_events' in body ? formToSubEvents(body) : undefined
    const event = await updateEvent(id, formToPartialWriteInput(body), subEvents)
    return NextResponse.json(event)
  } catch (error) {
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff', 'comunicaciones')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await deleteEvent(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/events/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
