import { createAdminClient } from '../../src/lib/supabase/admin'
const DOUGLAS = 'f9fb64b1-e42f-4a3f-950e-1200480ac5c7'
const JOSUE = '6f287f18-8f58-49fa-b035-639b1b1a5252'
async function main() {
  const sb = createAdminClient()
  for (const [nombre, G] of [['Douglas Montero', DOUGLAS], ['Josué Sánchez', JOSUE]] as const) {
    console.log(`\n═══════ ${nombre}`)
    const { data: enr } = await sb.from('study_enrollments').select('member_id, status').eq('group_id', G)
    const activos = new Set((enr ?? []).filter(e => (e as {status:string}).status === 'enrolled').map(e => (e as {member_id:string}).member_id))
    const { data: pagos } = await sb.from('payments').select('member_id, status, amount, payment_date, enrollment_id').eq('study_group_id', G)
    const pagaron = new Map<string, {status:string; fecha:string}>()
    for (const p of (pagos ?? []) as {member_id:string; status:string; payment_date:string}[]) {
      if (p.status === 'paid') pagaron.set(p.member_id, { status: p.status, fecha: p.payment_date })
    }
    const nombreDe = async (id: string) => {
      const { data } = await sb.from('members').select('first_name, last_name').eq('id', id).maybeSingle()
      return `${(data as {first_name:string}|null)?.first_name} ${(data as {last_name:string}|null)?.last_name}`
    }
    console.log(`matriculados activos: ${activos.size} · pagaron: ${pagaron.size}`)
    console.log('\n  PAGARON pero NO están matriculados acá:')
    let huecos = 0
    for (const [id, p] of pagaron) {
      if (activos.has(id)) continue
      huecos++
      const { data: otra } = await sb.from('study_enrollments').select('group_id, status').eq('member_id', id).eq('group_id', G).maybeSingle()
      console.log(`     ⚠️  ${await nombreDe(id)} — pagó el ${p.fecha} · su matrícula acá: ${otra ? (otra as {status:string}).status : 'NO EXISTE'}`)
    }
    if (!huecos) console.log('     (ninguno)')
    console.log('\n  matriculados que NO pagaron:')
    let sinPago = 0
    for (const id of activos) {
      if (pagaron.has(id)) continue
      sinPago++
      console.log(`     · ${await nombreDe(id)}`)
    }
    if (!sinPago) console.log('     (ninguno)')
  }
}
main().catch(e => { console.error(e); process.exit(1) })
