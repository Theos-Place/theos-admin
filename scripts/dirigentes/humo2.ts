/**
 * Verifica los guards de ENTRADA al Comité Dirigentes desde servidores, sin
 * escribir nada: se le pide a assignVolunteer que agregue a alguien que está
 * "en revisión" y se comprueba que tire ANTES del upsert (o sea, que el
 * voluntario NO quede creado).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { assignVolunteer } from '@/lib/supabase/queries/servers'

async function main() {
  const sb = createAdminClient()
  const { data: enRev } = await sb.from('study_leaders')
    .select('member_id').eq('availability_status', 'en_revision').limit(1).maybeSingle()
  const memberId = (enRev as { member_id: string } | null)?.member_id
  if (!memberId) { console.log('no hay nadie en revisión para probar'); return }

  const { data: area } = await sb.from('areas').select('id').eq('name', 'Comité Dirigentes').maybeSingle()
  const { data: pos } = await sb.from('service_positions').select('id, title').eq('area_id', (area as { id: string }).id)
  const madrid = (pos as Array<{ id: string; title: string }>).find(p => p.title === 'Dirigente Madrid')!

  const antes = (await sb.from('volunteers').select('status').eq('member_id', memberId).eq('position_id', madrid.id).maybeSingle()).data
  console.log(`persona en revisión: ${memberId}`)
  console.log(`voluntario en "Dirigente Madrid" ANTES: ${JSON.stringify(antes)}`)

  try {
    await assignVolunteer(madrid.id, memberId)
    console.log('>>> NO tiró: el guard no está funcionando')
  } catch (e) {
    console.log(`>>> tiró: ${e instanceof Error ? e.message : e}`)
  }
  const despues = (await sb.from('volunteers').select('status').eq('member_id', memberId).eq('position_id', madrid.id).maybeSingle()).data
  console.log(`voluntario en "Dirigente Madrid" DESPUÉS: ${JSON.stringify(despues)}`)
  console.log(JSON.stringify(antes) === JSON.stringify(despues)
    ? '\n>>> no se escribió nada: el guard corre ANTES del upsert'
    : '\n>>> SE ESCRIBIÓ: el cambio quedó a medias')
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
