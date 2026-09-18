/**
 * Guarda el anuncio como PLANTILLA, no como comunicación.
 *
 * A propósito: la comunicación la crea el usuario desde la pantalla, que es
 * donde se elige la audiencia. Este correo va a un grupo acotado —servidores
 * que no fueron al campa— y esa decisión no la toma un script.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { readFileSync } from 'node:fs'

const ASUNTO = '¿No pudiste ir al campa? Te armamos otro 🏁'

const OPCIONES = [
  { nombre: 'Mini Campa — 10 oct (servidores que no fueron)', archivo: '/tmp/cuerpo.html' },
]

async function main() {
  const sb = createAdminClient()
  // Se retiran las versiones descartadas: la primera y las dos opciones A/B.
  // Decisión del usuario 2026-09-18: una sola, con el flyer.
  for (const viejo of [
    'Hacia la Meta — 10 oct (servidores que no fueron al campa)',
    'Hacia la Meta — 10 oct (A · flyer)',
    'Hacia la Meta — 10 oct (B · video)',
  ]) await sb.from('message_templates').delete().eq('name', viejo)

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
  console.log(`\nasunto: ${ASUNTO}`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
