/**
 * Prueba del recordatorio «última llamada» de la Actividad Servidores del 10
 * de octubre. Va SOLO a Floriana, que lo pidió así el 2026-10-07 antes de
 * mandarlo a los 524 que todavía no se inscriben.
 *
 * El cuerpo se lee de la PLANTILLA en base de datos y no de un archivo: lo
 * que llega a esta prueba es exactamente lo que va a mandar la pantalla de
 * comunicaciones. Con un archivo aparte, aprobar la prueba no probaría nada
 * de lo que se envía después.
 */
import { sendEmail } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/baseLayout'
import { createAdminClient } from '@/lib/supabase/admin'

const PLANTILLA = '8236e564-d885-4085-b3ee-fb045a463bc0'
const DESTINO = 'ti@theosplace.org'

async function main() {
  const sb = createAdminClient()
  const { data: t } = await sb.from('message_templates')
    .select('name, subject, body').eq('id', PLANTILLA).single()
  if (!t) throw new Error('No existe la plantilla ' + PLANTILLA)

  const { data: m } = await sb.from('members')
    .select('first_name').ilike('email', DESTINO).limit(1).maybeSingle()
  const nombre = (m as { first_name: string } | null)?.first_name ?? 'Theos'

  const r = await sendEmail({
    to: { email: DESTINO, name: nombre },
    subject: t.subject as string,
    html: renderEmail((t.body as string).replace(/\{nombre\}/g, nombre)),
    kind: 'transactional', // prueba: sin pie de baja
  })
  console.log(`${t.name}\nasunto: ${t.subject}\n→ ${DESTINO} como "${nombre}": ${r.enviado ? '✓ salió' : '✗ ' + r.motivo}`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
