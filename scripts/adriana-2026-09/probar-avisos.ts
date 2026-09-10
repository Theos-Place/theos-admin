/**
 * Los tres avisos del traslado, y el filtro por familia de estudio.
 * Todo con datos [prueba] y correos .invalid (el provider los omite).
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { transferEnrollment, TransferenciaBloqueada } from '../../src/lib/supabase/queries/transfer-enrollment'

async function main() {
  const sb = createAdminClient()
  const plan = async (code: string) => {
    const { data } = await sb.from('study_plans').select('id, cost, level, code').eq('code', code).single()
    return data as { id: string; cost: number; level: string; code: string }
  }
  const persona = async (nombre: string) => {
    const { data } = await sb.from('members').insert({
      first_name: '[prueba]', last_name: nombre,
      email: `${nombre.toLowerCase().replace(/ /g,'.')}@prueba.theosplace.invalid`, is_active: true,
    }).select('id').single()
    return (data as { id: string }).id
  }
  const grupo = async (nombre: string, p: { id: string }, leader: string) => {
    const { data } = await sb.from('study_groups').insert({
      name: nombre, plan_id: p.id, status: 'en_matricula', leader_id: leader,
      schedule_days: ['L'], schedule_time: '19:00', location: '[prueba] Sala', max_students: 10,
      starts_at: '2026-10-05',
    }).select('id').single()
    return (data as { id: string }).id
  }

  const n3 = await plan('N3'), n4 = await plan('N4'), pan = await plan('PAN'), premat = await plan('PREMAT')
  const dirA = await persona('Dirigente Sale'), dirB = await persona('Dirigente Entra')
  const alu = await persona('Alumna Movida')
  const gN3 = await grupo('[prueba] Nivel 3 origen', n3, dirA)
  const gN4 = await grupo('[prueba] Nivel 4 destino', n4, dirB)
  const gPAN = await grupo('[prueba] Panorama destino', pan, dirB)
  const gPM = await grupo('[prueba] Prematrimonial destino', premat, dirB)
  const { data: e } = await sb.from('study_enrollments').insert({
    member_id: alu, group_id: gN3, plan_id: n3.id, status: 'enrolled', enrolled_at: new Date().toISOString(),
  }).select('id').single()
  const EID = (e as { id: string }).id
  await sb.from('payments').insert({
    member_id: alu, amount: n3.cost, currency: 'CRC', payment_method: 'comprobante', concept: 'matricula',
    entity_type: 'study_group', enrollment_id: EID, study_group_id: gN3, status: 'paid',
    review_status: 'aprobado', payment_date: new Date().toISOString().slice(0,10),
  })

  const mover = async (etiqueta: string, hacia: string) => {
    try {
      const r = await transferEnrollment({
        memberId: alu, desdeGroupId: gN3, haciaGroupId: hacia,
        actorMemberId: null, actorNombre: '[prueba] Camila',
      })
      console.log(`   ✓ ${etiqueta}: ${r.mensaje}`)
      return r
    } catch (err) {
      if (err instanceof TransferenciaBloqueada) { console.log(`   ⛔ ${etiqueta}: ${err.message}`); return null }
      throw err
    }
  }

  console.log('1) Nivel 3 → Panorama (otra familia)')
  await mover('a capacitación', gPAN)
  console.log('2) Nivel 3 → Prematrimonial')
  await mover('a prematrimonial', gPM)
  console.log('3) Nivel 3 → Nivel 4 (misma familia)')
  await mover('a otro Nivel', gN4)

  const { data: enr } = await sb.from('study_enrollments').select('group_id, status').eq('member_id', alu)
  console.log('\nmatrículas:', JSON.stringify(enr))
  const { data: logs } = await sb.from('message_logs')
    .select('recipient, subject, status').in('recipient', [
      `${'alumna movida'.replace(/ /g,'.')}@prueba.theosplace.invalid`,
      `${'dirigente sale'.replace(/ /g,'.')}@prueba.theosplace.invalid`,
      `${'dirigente entra'.replace(/ /g,'.')}@prueba.theosplace.invalid`,
    ])
  console.log('correos registrados:', (logs ?? []).length)
  for (const l of (logs ?? []) as Record<string,unknown>[]) console.log(`   ${l.recipient} → ${l.subject} [${l.status}]`)

  for (const g of [gN3, gN4, gPAN, gPM]) {
    const { data: es } = await sb.from('study_enrollments').select('id').eq('group_id', g)
    const ids = (es ?? []).map(x => (x as {id:string}).id)
    if (ids.length) { await sb.from('payments').delete().in('enrollment_id', ids); await sb.from('study_enrollments').delete().in('id', ids) }
    await sb.from('payments').delete().eq('study_group_id', g)
    await sb.from('study_groups').delete().eq('id', g)
  }
  for (const m of [alu, dirA, dirB]) { await sb.from('payments').delete().eq('member_id', m); await sb.from('members').delete().eq('id', m) }
  console.log('✓ limpio')
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
