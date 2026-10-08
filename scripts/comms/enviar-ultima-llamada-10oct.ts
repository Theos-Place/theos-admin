/**
 * Envía el recordatorio «última llamada» de la Actividad Servidores del 10 de
 * octubre a la lista «Recordatorio 10-oct — servidores sin inscribir».
 *
 * NO manda los correos a mano: arma el broadcast y llama a `sendBroadcast`,
 * la MISMA función que usa la pantalla de comunicaciones. Por eso respeta las
 * bajas, los rebotes y las quejas, deja `message_logs` por persona y el envío
 * se puede auditar después. Un bucle de `sendEmail` no haría nada de eso.
 *
 * Sin `--enviar` solo mide y no escribe nada.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBroadcast, type Recipient } from '@/lib/supabase/queries/communications'

const PLANTILLA = '8236e564-d885-4085-b3ee-fb045a463bc0'
const LISTA = '7ea71bba-9ebe-448d-8bf1-b23b14e5e20f'
const EVENTO = 'a43567a3-0adb-424c-8e8a-98dcad09b826'
const ENVIAR = process.argv.includes('--enviar')

async function main() {
  const sb = createAdminClient()

  const { data: t } = await sb.from('message_templates')
    .select('subject, body').eq('id', PLANTILLA).single()
  if (!t) throw new Error('No existe la plantilla')

  const { data: l } = await sb.from('member_lists')
    .select('name, member_ids').eq('id', LISTA).single()
  if (!l) throw new Error('No existe la lista')
  const ids = (l.member_ids as string[])

  /**
   * SE RECALCULA QUIÉN YA SE INSCRIBIÓ, aunque la lista se armó filtrando por
   * eso mismo. Entre que se guardó y se manda pueden pasar horas, y mandarle
   * «última oportunidad para apuntarse» a alguien que se apuntó ayer es el
   * tipo de error que la gente sí nota.
   */
  const yaInscritos = new Set<string>()
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await sb.from('event_registrations')
      .select('member_id').eq('event_id', EVENTO).in('member_id', ids.slice(i, i + 300))
    for (const r of (data ?? []) as Array<{ member_id: string }>) yaInscritos.add(r.member_id)
  }
  const destino = ids.filter(id => !yaInscritos.has(id))

  console.log(`lista: ${l.name}`)
  console.log(`asunto: ${t.subject}`)
  console.log(`en la lista: ${ids.length}  ·  se inscribieron desde que se armó: ${yaInscritos.size}  ·  se les manda: ${destino.length}`)
  if (!ENVIAR) { console.log('\n(solo medición; agregá --enviar)'); return }

  const { data: b, error } = await sb.from('message_broadcasts').insert({
    subject: t.subject, body: t.body, body_format: 'html',
    channel: 'email', kind: 'marketing', status: 'draft',
    template_id: PLANTILLA, segment_label: l.name, total_recipients: destino.length,
  }).select('id').single()
  if (error) throw error

  const recipients: Recipient[] = destino.map(id => ({ member_id: id, channel: 'email', recipient: '' }))
  await sendBroadcast(b.id as string, recipients)

  const { data: fin } = await sb.from('message_broadcasts')
    .select('status, sent_count, skipped_count, failed_count').eq('id', b.id).single()
  console.log(`\nbroadcast ${b.id}`)
  console.log(fin)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
