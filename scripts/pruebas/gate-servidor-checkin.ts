/**
 * SRV-1 · El gate de "servidor" en el check-in, probado de punta a punta.
 *
 * QUÉ PROTEGE. En el check-in se puede marcar a alguien como SERVIDOR en vez
 * de participante. Esa etiqueta alimenta el conteo de servidores del evento,
 * así que no puede depender del cliente: la pantalla consulta server-check
 * para pintar el botón, pero eso es cortesía. Quien mande el POST a mano no
 * debe poder inflar el conteo.
 *
 * LA REGLA, en createCheckin: solo califica como servidor quien sirve ACTIVO
 * en algún comité organizador del evento. Quien no califica entra como
 * ASISTENTE, no se le rechaza el check-in — la persona sí estuvo, y perder su
 * asistencia por una etiqueta sería peor que corregir la etiqueta.
 *
 * Esto se prueba contra la base real porque la regla vive en una consulta, no
 * en una función pura: un test con mocks probaría el mock.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/pruebas/gate-servidor-checkin.ts
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { createCheckin } from '../../src/lib/supabase/queries/events'

const MARCA = '[prueba] SRV-1'

/** Sin esto un insert que falla devuelve null y el script muere diciendo
 *  "cannot read properties of null", que no dice nada. */
function exigir<T>(r: { data: T | null; error: { message: string } | null }, que: string): T {
  if (r.error) throw new Error(`${que}: ${r.error.message}`)
  if (!r.data) throw new Error(`${que}: no devolvió nada`)
  return r.data
}
let fallas = 0

function verificar(que: string, real: unknown, esperado: unknown) {
  const ok = JSON.stringify(real) === JSON.stringify(esperado)
  if (!ok) fallas++
  console.log(`  ${ok ? '✓' : '✗'} ${que}${ok ? '' : ` — esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`}`)
}

async function main() {
  const sb = createAdminClient()

  // ── Montaje: un comité con un puesto, dos personas (una sirve ahí y la otra
  //    no) y un evento organizado por ese comité.
  const areaId = exigir(await sb.from('areas')
    .insert({ name: `${MARCA} Comité`, area_type: 'committee', is_active: true })
    .select('id').single(), 'crear comité').id
  const posId = exigir(await sb.from('service_positions')
    .insert({ area_id: areaId, title: `${MARCA} Colaborador`, is_active: true, quantity: 5 })
    .select('id').single(), 'crear puesto').id

  const persona = async (apellido: string) => exigir(await sb.from('members').insert({
    first_name: '[prueba]', last_name: apellido,
    email: `${apellido.toLowerCase().replace(/ /g, '.')}@prueba.theosplace.invalid`, is_active: true,
  }).select('id').single(), `crear ${apellido}`).id
  const sirve = await persona('SRV Sirve')
  const noSirve = await persona('SRV No Sirve')
  const inactivo = await persona('SRV Inactivo')
  await sb.from('volunteers').insert([
    { position_id: posId, member_id: sirve, status: 'active', start_date: '2026-01-01' },
    { position_id: posId, member_id: inactivo, status: 'inactive', start_date: '2026-01-01' },
  ])

  const eventId = exigir(await sb.from('events').insert({
    title: `${MARCA} Evento`, starts_at: new Date().toISOString(), event_type: 'social',
    requires_registration: false, requires_payment: false,
  }).select('id').single(), 'crear evento').id
  await sb.from('event_organizing_committees').insert({ event_id: eventId, committee_id: areaId })

  const calidadDe = async (memberId: string) => {
    const { data } = await sb.from('event_checkins')
      .select('checked_in_as').eq('event_id', eventId).eq('member_id', memberId).maybeSingle()
    return (data as { checked_in_as: string } | null)?.checked_in_as ?? null
  }

  try {
    console.log('\n── Quien SÍ sirve en un comité organizador')
    await createCheckin(eventId, { member_id: sirve, checked_in_as: 'servidor', method: 'manual' })
    verificar('queda como servidor', await calidadDe(sirve), 'servidor')

    console.log('\n── Quien NO sirve, pidiendo ser servidor (el POST a mano)')
    await createCheckin(eventId, { member_id: noSirve, checked_in_as: 'servidor', method: 'manual' })
    verificar('el gate lo baja a asistente', await calidadDe(noSirve), 'asistente')
    verificar('pero SÍ le queda el check-in: estuvo', await calidadDe(noSirve) !== null, true)

    console.log('\n── Quien sirvió pero ya está INACTIVO en el puesto')
    await createCheckin(eventId, { member_id: inactivo, checked_in_as: 'servidor', method: 'manual' })
    verificar('también baja a asistente', await calidadDe(inactivo), 'asistente')

    console.log('\n── El conteo del evento no se infló')
    const { data: todos } = await sb.from('event_checkins').select('checked_in_as').eq('event_id', eventId)
    const servidores = (todos ?? []).filter(c => (c as { checked_in_as: string }).checked_in_as === 'servidor').length
    verificar('un solo servidor, no tres', servidores, 1)

    console.log('\n── Un evento SIN comités organizadores')
    const ev2Id = exigir(await sb.from('events').insert({
      title: `${MARCA} Evento sin comités`, starts_at: new Date().toISOString(), event_type: 'social',
      requires_registration: false, requires_payment: false,
    }).select('id').single(), 'crear evento sin comités').id
    await createCheckin(ev2Id, { member_id: sirve, checked_in_as: 'servidor', method: 'manual' })
    const { data: c2 } = await sb.from('event_checkins')
      .select('checked_in_as').eq('event_id', ev2Id).eq('member_id', sirve).maybeSingle()
    verificar('nadie es servidor si el evento no tiene comités', (c2 as { checked_in_as: string }).checked_in_as, 'asistente')
    await sb.from('event_checkins').delete().eq('event_id', ev2Id)
    await sb.from('events').delete().eq('id', ev2Id)
  } finally {
    // ── Desmontaje, pase lo que pase.
    await sb.from('event_checkins').delete().eq('event_id', eventId)
    await sb.from('event_organizing_committees').delete().eq('event_id', eventId)
    await sb.from('events').delete().eq('id', eventId)
    await sb.from('volunteers').delete().eq('position_id', posId)
    await sb.from('service_positions').delete().eq('id', posId)
    await sb.from('areas').delete().eq('id', areaId)
    for (const id of [sirve, noSirve, inactivo]) await sb.from('members').delete().eq('id', id)
    console.log('\n✓ datos de prueba borrados')
  }

  console.log(fallas === 0 ? '\n✓ el gate de servidor aguanta' : `\n✗ ${fallas} fallas`)
  process.exit(fallas === 0 ? 0 : 1)
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
