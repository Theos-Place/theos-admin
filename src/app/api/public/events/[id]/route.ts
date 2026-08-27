import { NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET público de UN evento, para la página que se comparte por link o QR.
 *
 * INVARIANTE DE PRIVACIDAD: esta ruta no pide sesión, así que la respuesta es
 * una whitelist escrita a mano — nunca un spread del evento. Van solo los datos
 * que ya están en el flyer.
 *
 * El cupo se responde como BANDERA, no como número: quien mira el link de
 * afuera necesita saber si puede inscribirse, no cuánta gente hay adentro. El
 * conteo de inscritos es dato interno.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!rateLimit(`public-event:${clientIp(req)}`, 60, 60_000)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
    }
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('events')
      .select(`
        id, title, description, event_type, status, starts_at, ends_at, is_public,
        location, location_url, is_virtual, requires_registration,
        max_capacity, requires_payment, payment_amount, currency, flyer_url
      `)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    const e = data as Record<string, unknown> | null
    // A PROPÓSITO no se filtra por is_public: un evento interno se comparte por
    // este link (WhatsApp, QR) y tiene que abrir. "Interno" quiere decir que no
    // se LISTA, no que sea secreto. El filtro va en /api/public/events (la
    // cartelera) y en las listas del calendario de los miembros.
    //
    // Cancelado o archivado: para quien llega de afuera no existe. Se responde
    // 404 y no "cancelado" a propósito — un link viejo no debería anunciar nada.
    if (!e || e.status === 'cancelled' || e.status === 'archived') {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
    }

    // Cupo: solo la bandera. El count va con head:true para no traer filas.
    let cupo_lleno = false
    const max = typeof e.max_capacity === 'number' ? e.max_capacity : null
    if (max && max > 0) {
      // MISMO criterio que computeEventEligibility: ocupan cupo las
      // inscripciones con payment_status pending, paid o exempted. Si acá se
      // contara distinto, la página pública diría "hay lugar" y el sistema
      // rechazaría al inscribirse (o al revés).
      const { count } = await supabase
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id)
        .in('payment_status', ['pending', 'paid', 'exempted'])
      cupo_lleno = (count ?? 0) >= max
    }

    return NextResponse.json({
      id: e.id,
      title: e.title,
      description: e.description,
      event_type: e.event_type,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      location: e.location,
      location_url: e.location_url,
      is_virtual: e.is_virtual,
      requires_registration: e.requires_registration,
      requires_payment: e.requires_payment,
      payment_amount: e.payment_amount,
      currency: e.currency ?? 'CRC',
      flyer_url: e.flyer_url,
      cupo_lleno,
      /** La inscripción se cierra cuando el evento empieza — MISMO criterio que
       *  /api/eventos/elegibilidad, para que la página pública no ofrezca algo
       *  que la app va a rechazar. Se calcula acá y no en el cliente: el reloj
       *  del visitante puede estar mal, y `Date.now()` en render es impuro. */
      inscripcion_cerrada: typeof e.starts_at === 'string'
        && new Date(e.starts_at).getTime() < Date.now(),
    })
  } catch (error) {
    console.error('GET /api/public/events/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
