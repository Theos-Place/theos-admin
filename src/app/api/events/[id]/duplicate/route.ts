import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { EVENT_WRITE_ROLES } from '@/lib/auth/roles'
import { getEventById, createEvent } from '@/lib/supabase/queries/events'
import { eventoDuplicado } from '@/lib/events/duplicate'

// POST: crea una copia del evento. Devuelve el evento nuevo (201).
//
// Se hace en el servidor y no en el cliente —como sí se duplican los
// formularios— porque un evento tiene sub-eventos, comités organizadores y
// veinte campos de configuración, y la LISTA carga una versión liviana. Armar
// la copia desde lo que la pantalla tiene a mano perdería la mitad en silencio.
//
// Qué se copia y qué no está en lib/events/duplicate.ts, con tests.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...EVENT_WRITE_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const origen = await getEventById(id)
    if (!origen) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    // Los sub-eventos se recrean con nombre y cupo; sus ids son del original.
    const subEventos = (origen.sub_events ?? []).map(s => ({ name: s.name, max_capacity: s.max_capacity }))
    const comites = (origen.organizing_committees ?? []).map(c => c.committee_id)

    const creado = await createEvent(
      eventoDuplicado(origen),
      subEventos,
      auth.ctx.userId,
      comites,
    )
    return NextResponse.json(creado, { status: 201 })
  } catch (error) {
    console.error('POST /api/events/[id]/duplicate:', error)
    // El mensaje real, como en el POST de eventos: un fallo de FK o de columna
    // se entiende, "Error interno" no.
    const msg = (error as { message?: string })?.message ?? 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
