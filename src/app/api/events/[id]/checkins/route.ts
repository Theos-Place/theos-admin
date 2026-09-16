import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import {
  createCheckin, deleteCheckin, getEventAttendeeIds, getCheckinExistente, NotRegisteredError,
} from '@/lib/supabase/queries/events'
import { YA_REGISTRADO } from '@/lib/events/checkin-duplicado'

// GET: asistentes (member_ids con check-in) de un evento. Para elegir audiencia
// en comunicaciones. Devuelve { count, member_ids }.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('comunicaciones', 'direccion', 'encargado_eventos')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const member_ids = await getEventAttendeeIds(id)
    return NextResponse.json({ count: member_ids.length, member_ids })
  } catch (error) {
    console.error('GET /api/events/[id]/checkins:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: registra un check-in. Body: { member_id?, guest_name?, sub_event_id?, method? }
// El constraint checkin_member_or_guest exige member_id O guest_name.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    // Check-in operable por encargado_eventos, dirección y admin (admin pasa siempre).
    const auth = await requireRoles('encargado_eventos', 'direccion')
    if (auth.res) return auth.res
  // Fuera del try: el catch los necesita para armar el 409 informativo, y el
  // body de un Request se puede leer UNA sola vez.
  const { id } = await params
  const body = await req.json().catch(() => null)
  const memberId = body?.member_id ?? null
  try {
    // La pantalla habla de 'participant'/'server'; la base de
    // 'asistente'/'servidor'. La traducción vive en un solo lugar, y
    // createCheckin REVALIDA la elección contra los comités organizadores.
    const { calidadDesdeTipo } = await import('@/lib/events/calidad-checkin')
    const calidad = calidadDesdeTipo(body?.attendance_type)
    const guestName = typeof body?.guest_name === 'string' ? body.guest_name.trim() : ''
    if (!memberId && !guestName) {
      return NextResponse.json(
        { error: 'Se requiere un miembro o un nombre de invitado para el check-in' },
        { status: 400 },
      )
    }
    const res = await createCheckin(id, {
      ...body,
      guest_name: memberId ? body.guest_name ?? null : guestName,
      checked_in_as: calidad,
      // Quién lo registró. Hasta hoy no se guardaba y por eso no se podía
      // contestar "¿quién la marcó?" en ningún reclamo.
      checked_in_by: auth.ctx.userId,
    })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    /**
     * Ya tenía check-in HOY en este evento (único por miembro, evento y día).
     *
     * El 409 devuelve los DATOS del check-in que ya existe —hora, calidad,
     * operador— y no solo un mensaje: la pantalla los usa para pintar el panel
     * de "ya estaba registrada" en vez de un error. Esto vale sobre todo cuando
     * dos operadores trabajan en paralelo y el estado local de uno está viejo:
     * el servidor es el que sabe.
     */
    if ((error as { code?: string })?.code === '23505') {
      const existente = memberId ? await getCheckinExistente(id, memberId) : null
      return NextResponse.json(
        { error: 'Esta persona ya tiene check-in en este evento.', code: YA_REGISTRADO, checkin: existente },
        { status: 409 },
      )
    }
    // Evento pago sin inscripción previa: mismo caso para los 3 métodos.
    if (error instanceof NotRegisteredError) {
      return NextResponse.json({ error: error.message, code: 'not_registered' }, { status: 409 })
    }
    console.error('POST /api/events/[id]/checkins:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: deshace un check-in. ?checkinId=<uuid>. Mismos roles que el alta.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles('encargado_eventos', 'direccion')
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const checkinId = req.nextUrl.searchParams.get('checkinId')
    if (!checkinId) return NextResponse.json({ error: 'Falta checkinId' }, { status: 400 })
    await deleteCheckin(id, checkinId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/events/[id]/checkins:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
