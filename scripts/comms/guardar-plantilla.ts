/**
 * Guarda el anuncio como PLANTILLA, no como comunicación.
 *
 * A propósito: la comunicación la crea el usuario desde la pantalla, que es
 * donde se elige la audiencia. Este correo va a un grupo acotado —servidores
 * que no fueron al campa— y esa decisión no la toma un script.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { readFileSync } from 'node:fs'

const ASUNTO = '¿Te perdiste el campa? Debbie tiene una mega noticia 🎥'

/** Las dos opciones que se mandaron a revisar el 2026-09-18. Cuando se elija
 *  una, la otra se borra desde la pantalla de plantillas. */
const OPCIONES = [
  { nombre: 'Hacia la Meta — 10 oct (A · flyer)', archivo: '/tmp/cuerpo.html' },
  { nombre: 'Hacia la Meta — 10 oct (B · video)', archivo: '/tmp/cuerpo-b.html' },
]

async function main() {
  const sb = createAdminClient()
  // La primera versión se guardó con otro nombre; se retira para no dejar tres.
  await sb.from('message_templates').delete()
    .eq('name', 'Hacia la Meta — 10 oct (servidores que no fueron al campa)')

  for (const o of OPCIONES) {
    const body = readFileSync(o.archivo, 'utf8')
    const fila = {
      name: o.nombre, channel: 'email', subject: ASUNTO, body,
      body_format: 'html', category: 'general', is_active: true, is_system: false,
    }
    const { data: ya } = await sb.from('message_templates').select('id').eq('name', o.nombre).maybeSingle()
    if (ya) {
      const { error } = await sb.from('message_templates').update(fila).eq('id', (ya as { id: string }).id)
      if (error) throw error
      console.log(`actualizada: ${o.nombre}`)
    } else {
      const { error } = await sb.from('message_templates').insert(fila)
      if (error) throw error
      console.log(`creada:      ${o.nombre}`)
    }
    console.log(`             ${body.length} caracteres de HTML`)
  }
  console.log(`\nasunto de las dos: ${ASUNTO}`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
