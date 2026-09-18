/**
 * Guarda el anuncio como PLANTILLA, no como comunicación.
 *
 * A propósito: la comunicación la crea el usuario desde la pantalla, que es
 * donde se elige la audiencia. Este correo va a un grupo acotado —servidores
 * que no fueron al campa— y esa decisión no la toma un script.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { readFileSync } from 'node:fs'

const NOMBRE = 'Hacia la Meta — 10 oct (servidores que no fueron al campa)'
const ASUNTO = '¿Te perdiste el campa? Debbie tiene una mega noticia 🎥'

async function main() {
  const sb = createAdminClient()
  const body = readFileSync('/tmp/cuerpo.html', 'utf8')
  const { data: ya } = await sb.from('message_templates').select('id').eq('name', NOMBRE).maybeSingle()
  const fila = {
    name: NOMBRE, channel: 'email', subject: ASUNTO, body,
    body_format: 'html', category: 'general', is_active: true, is_system: false,
  }
  if (ya) {
    const { error } = await sb.from('message_templates').update(fila).eq('id', (ya as { id: string }).id)
    if (error) throw error
    console.log(`actualizada: ${NOMBRE}`)
  } else {
    const { data, error } = await sb.from('message_templates').insert(fila).select('id').single()
    if (error) throw error
    console.log(`creada: ${NOMBRE}\n  id ${(data as { id: string }).id}`)
  }
  console.log(`  asunto: ${ASUNTO}`)
  console.log(`  ${body.length} caracteres de HTML`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
