/**
 * Manda el anuncio "Hacia la Meta" SOLO a una dirección, para revisarlo en un
 * cliente de correo real antes de crear la comunicación.
 *
 * El destinatario va fijo y por parámetro explícito: este script NO toca
 * audiencias ni listas. Pedido del usuario el 2026-09-18.
 */
import { sendEmail } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/baseLayout'
import { createAdminClient } from '@/lib/supabase/admin'
import { readFileSync } from 'node:fs'

const DESTINO = 'ti@theosplace.org'
const ASUNTO = '¿Te perdiste el campa? Debbie tiene una mega noticia 🎥'

async function main() {
  // El nombre real de quien recibe, para que {nombre} se vea como se va a ver.
  const sb = createAdminClient()
  const { data } = await sb.from('members').select('first_name').eq('email', DESTINO).maybeSingle()
  const nombre = (data as { first_name?: string } | null)?.first_name ?? 'Marta'

  const cuerpo = readFileSync('/tmp/cuerpo.html', 'utf8').replace(/\{nombre\}/g, nombre)
  const r = await sendEmail({
    to: { email: DESTINO, name: nombre },
    subject: ASUNTO,
    html: renderEmail(cuerpo),
    kind: 'transactional', // prueba: sin pie de baja ni List-Unsubscribe
  })
  console.log(`a ${DESTINO} (como "${nombre}")`)
  console.log(`  asunto: ${ASUNTO}`)
  console.log(`  ¿salió?: ${r.enviado ? 'SÍ' : 'NO — ' + r.motivo}`)
  console.log(`  id: ${r.messageId}`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
