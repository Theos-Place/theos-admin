/** Qué dice el reporte de personas nuevas para la charla del 9/9, con el
 *  mismo código que usa la pantalla. */
import { getEventById } from '../../src/lib/supabase/queries/events'
import { contarPersonasNuevas } from '../../src/lib/events/personas-nuevas'
import { createAdminClient } from '../../src/lib/supabase/admin'

const EV = 'd40fad32-5fec-4fb8-91e1-f58e644c711e' // Charla Pedregal Miércoles
const MIRAR = ['Karla Rodríguez Guerrero', 'María Cristina Víquez León', 'Matthew Vargas Víquez', 'Stephanie Porras']

async function main() {
  const sb = createAdminClient()
  const ev = await getEventById(EV)
  if (!ev) throw new Error('no está el evento')
  const checkins = (ev.checkins ?? []) as Array<Record<string, unknown>>
  console.log(`evento: ${ev.title} · arranca ${ev.starts_at} · check-ins ${checkins.length}`)

  const conteo = contarPersonasNuevas(
    checkins.map(c => ({
      member_id: (c.member_id as string) ?? null,
      checked_at: (c.checked_in_at as string) ?? null,
      member_created_at: (c.member as { created_at?: string } | null)?.created_at ?? null,
      member_first_checkin_at: (c.member_first_checkin_at as string | undefined),
    })),
    ev.starts_at as string,
  )
  console.log(`\nel reporte dice: ${conteo.nuevas} nuevas de ${conteo.conFicha} con ficha (${conteo.porcentaje}%)`)

  console.log('\n── las que nos interesan')
  for (const nombre of MIRAR) {
    const [pri, ...resto] = nombre.split(' ')
    const { data: ms } = await sb.from('members').select('id, first_name, last_name, created_at').ilike('first_name', `%${pri}%`)
    const m = (ms ?? []).find(x => resto.every(r => `${(x as {first_name:string}).first_name} ${(x as {last_name:string}).last_name}`.toLowerCase().includes(r.toLowerCase())))
    if (!m) { console.log(`   ${nombre}: no la encuentro`); continue }
    const id = (m as {id:string}).id
    const c = checkins.find(x => x.member_id === id)
    if (!c) { console.log(`   ${nombre}: NO tiene check-in en este evento`); continue }
    const primero = c.member_first_checkin_at as string | undefined
    const esta = c.checked_in_at as string
    console.log(`   ${nombre.padEnd(30)} | este check-in ${String(esta).slice(0,19)} | su primero ${primero ? String(primero).slice(0,19) : 'SIN DATO'} | cuenta como nueva: ${primero && Date.parse(primero) === Date.parse(esta) ? 'SÍ' : 'no'}`)
  }
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
