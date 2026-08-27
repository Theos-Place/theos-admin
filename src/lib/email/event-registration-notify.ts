/**
 * Confirmación de inscripción a un evento (transaccional). Se dispara SIEMPRE al
 * inscribirse.
 *
 * OJO CON EL TEXTO DEL PAGO. Desde que el comprobante es obligatorio para
 * inscribirse, cuando este correo sale el comprobante YA ESTÁ ADENTRO. Decir
 * "queda pendiente el pago" —como decía la primera versión— es falso y peor que
 * no decir nada: la persona acaba de pagar y el correo le dice que no pagó, así
 * que vuelve a pagar o escribe preguntando.
 *
 * Lo que falta no es el pago, es que FINANZAS lo revise, y eso se resuelve
 * adentro. El correo lo dice así: recibimos el comprobante, no tenés que hacer
 * nada más.
 *
 * Best-effort: si el correo falla se loguea y NO rompe la inscripción.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { formatCRC } from '@/lib/format'

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
  opts: { comprobanteRecibido: boolean; amount: number },
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
        // Secciones como condicional: el motor de {{#...}} ignora lo que no es
        // array, así que un array vacío borra el bloque y uno de un elemento lo
        // muestra. Los campos de adentro viajan EN el objeto: dentro de una
        // sección las variables se resuelven contra el item, no contra la raíz.
        // Ya no hay bloque de "falta pagar": si el evento tenía costo, el
        // comprobante entró junto con la inscripción.
        en_revision: opts.comprobanteRecibido ? [{ monto: formatCRC(opts.amount) }] : [],
        sin_pago: opts.comprobanteRecibido ? [] : [{}],
      },
    })
  } catch (err) {
    console.warn('notifyEventRegistration:', err)
  }
}
