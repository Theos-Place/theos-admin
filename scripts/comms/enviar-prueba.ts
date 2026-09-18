/**
 * Manda las DOS opciones del anuncio "Hacia la Meta" a una lista corta de
 * correos internos, para elegir entre ellas antes de crear la comunicación.
 *
 * Los destinatarios van FIJOS en el archivo y son los que pidió el usuario el
 * 2026-09-18. Este script no toca audiencias ni listas: si algún día hay que
 * mandarlo a más gente, se hace desde la pantalla de comunicaciones.
 *
 * El asunto lleva "Opción A/B" SOLO en la prueba, para distinguirlas en la
 * bandeja. El asunto real va sin ese prefijo.
 */
import { sendEmail } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/baseLayout'
import { createAdminClient } from '@/lib/supabase/admin'
import { readFileSync } from 'node:fs'

const DESTINOS = [
  'ti@theosplace.org',
  'comunicacion@theosplace.org',
  'rh@theosplace.org',
  'operaciones@theosplace.org',
]

/**
 * El asunto lleva la NOTICIA, no la pregunta sola: lo que hace abrir es que
 * hay algo nuevo y que se hizo para quien lo lee. "Te armamos otro" cabe
 * entero en la bandeja del celular (43 caracteres).
 */
/**
 * El asunto NO dice "campa": prometerlo sería prometer otra cosa (Comité
 * Servidores, 2026-09-18). Dice qué se recupera —lo que se perdió— y en
 * cuánto. 40 caracteres: entra entero en la bandeja del celular.
 */
const ASUNTO = 'Lo que te perdiste del campa, en un día 🏁'

const OPCIONES = [
  { clave: 'única', archivo: '/tmp/cuerpo.html', nota: 'más corta, sin la palabra campa para el evento' },
]

async function main() {
  const sb = createAdminClient()
  // El nombre real de cada quien, para que {nombre} se vea como se va a ver.
  const { data } = await sb.from('members').select('email, first_name').in('email', DESTINOS)
  const nombre = new Map(((data ?? []) as Array<{ email: string; first_name: string }>)
    .map(m => [m.email.toLowerCase(), m.first_name]))

  for (const o of OPCIONES) {
    const plantilla = readFileSync(o.archivo, 'utf8')
    console.log(`\n── ${o.clave} (${o.nota})  ·  asunto: ${ASUNTO}`)
    for (const email of DESTINOS) {
      const quien = nombre.get(email.toLowerCase()) ?? 'Theos'
      const r = await sendEmail({
        to: { email, name: quien },
        subject: ASUNTO,
        html: renderEmail(plantilla.replace(/\{nombre\}/g, quien)),
        kind: 'transactional', // prueba: sin pie de baja
      })
      console.log(`   ${email.padEnd(30)} como "${quien.padEnd(12)}"  ${r.enviado ? '✓ salió' : '✗ ' + r.motivo}`)
    }
  }
  console.log(`\n${OPCIONES.length * DESTINOS.length} correos · solo a esas ${DESTINOS.length} direcciones`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
