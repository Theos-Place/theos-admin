/**
 * Confirmación de inscripción a un evento (transaccional). Se dispara SIEMPRE al
 * inscribirse — es lo que pidió el usuario el 2026-08-27 y sigue el criterio de
 * notifyEnrollment: quien acaba de inscribirse recibe confirmación, tenga pago
 * pendiente o no.
 *
 * Con pago pendiente el texto lo dice y lleva al comprobante, en vez de callarse:
 * la inscripción YA reservó el cupo, así que no avisar dejaría a la persona sin
 * saber si quedó o no.
 *
 * Best-effort: si el correo falla se loguea y NO rompe la inscripción.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { formatCRC } from '@/lib/format'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'

/** La fecha del evento en hora de COSTA RICA. Acá sí va zona fija: un correo no
 *  tiene visitante ni navegador del cual sacar la zona, y el evento ocurre en la
 *  zona de la organización. */
function fmtFechaHora(iso: string | null): string {
  if (!iso) return 'por confirmar'
  try {
    return new Date(iso).toLocaleString('es-CR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Costa_Rica',
    })
  } catch { return iso }
}

export async function notifyEventRegistration(
  memberId: string,
  eventId: string,
  opts: { requiresPayment: boolean; amount: number },
): Promise<void> {
  try {
    const supabase = createAdminClient()
    const [{ data: m }, { data: e }] = await Promise.all([
      supabase.from('members').select('first_name, last_name, email').eq('id', memberId).maybeSingle(),
      supabase.from('events').select('title, starts_at, location, is_virtual, location_url').eq('id', eventId).maybeSingle(),
    ])
    const member = m as { first_name: string | null; last_name: string | null; email: string | null } | null
    const evento = e as { title: string | null; starts_at: string | null; location: string | null; is_virtual: boolean | null; location_url: string | null } | null
    if (!member?.email || !evento) return

    const nombre = `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim()
    const lugar = evento.is_virtual
      ? (evento.location_url ? 'Virtual' : 'Virtual (te enviamos el enlace)')
      : (evento.location || 'por confirmar')

    await sendSystemEmail({
      systemKey: 'inscripcion_evento',
      to: { email: member.email, name: nombre },
      data: {
        nombre,
        nombre_evento: evento.title ?? 'el evento',
        fecha_evento: fmtFechaHora(evento.starts_at),
        lugar_evento: lugar,
        // Secciones como condicional: el motor de {{#...}} ignora lo que no es
        // array, así que un array vacío borra el bloque y uno de un elemento lo
        // muestra. Los campos de adentro viajan EN el objeto: dentro de una
        // sección las variables se resuelven contra el item, no contra la raíz.
        pago_pendiente: opts.requiresPayment
          // /eventos, NO /mis-eventos (esa ruta ya no existe) ni /mis-pagos (que
          // está vacía hasta que se sube el comprobante, porque el pago nace en
          // ese momento). En /eventos la tarjeta del evento ahora tiene el botón
          // "Subir comprobante".
          ? [{ monto: formatCRC(opts.amount), link_pago: `${SITE_URL}/eventos` }]
          : [],
        sin_pago: opts.requiresPayment ? [] : [{}],
      },
    })
  } catch (err) {
    console.warn('notifyEventRegistration:', err)
  }
}
