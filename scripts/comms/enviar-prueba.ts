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

const ASUNTO = '¿Te perdiste el campa? Debbie tiene una mega noticia 🎥'

const OPCIONES = [
  { clave: 'A', archivo: '/tmp/cuerpo.html',   nota: 'miniatura = flyer' },
  { clave: 'B', archivo: '/tmp/cuerpo-b.html', nota: 'miniatura = cuadro del video, flyer abajo' },
]

async function main() {
  const sb = createAdminClient()
  // El nombre real de cada quien, para que {nombre} se vea como se va a ver.
  const { data } = await sb.from('members').select('email, first_name').in('email', DESTINOS)
  const nombre = new Map(((data ?? []) as Array<{ email: string; first_name: string }>)
    .map(m => [m.email.toLowerCase(), m.first_name]))

  for (const o of OPCIONES) {
    const plantilla = readFileSync(o.archivo, 'utf8')
    console.log(`\n── Opción ${o.clave} (${o.nota})`)
    for (const email of DESTINOS) {
      const quien = nombre.get(email.toLowerCase()) ?? 'Theos'
      const r = await sendEmail({
        to: { email, name: quien },
        subject: `Opción ${o.clave} · ${ASUNTO}`,
        html: renderEmail(plantilla.replace(/\{nombre\}/g, quien)),
        kind: 'transactional', // prueba: sin pie de baja
      })
      console.log(`   ${email.padEnd(30)} como "${quien.padEnd(12)}"  ${r.enviado ? '✓ salió' : '✗ ' + r.motivo}`)
    }
  }
  console.log(`\n${OPCIONES.length * DESTINOS.length} correos · solo a esas ${DESTINOS.length} direcciones`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
