/**
 * Prueba real del traslado: crea una persona de prueba, la matricula con pago,
 * la mueve a otro grupo por el API y revisa qué quedó. Limpia todo al final.
 */
import { chromium } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'

const BASE = 'http://localhost:3000'
const SCJ_DOUGLAS = 'f9fb64b1-e42f-4a3f-950e-1200480ac5c7'  // SCJ ₡5.000

async function main() {
  const sb = createAdminClient()
  // Un grupo de OTRO estudio, más caro, para probar el caso de Religiones del Mundo.
  const { data: caros } = await sb.from('study_groups')
    .select('id, name, plan:study_plans!study_groups_plan_id_fkey(code, cost)')
    .eq('status', 'en_matricula').limit(200)
  const caro = (caros ?? []).find(g => Number((g as { plan: { cost: number } | null }).plan?.cost ?? 0) === 20000)
  const CARO = caro as { id: string; name: string; plan: { code: string; cost: number } }
  console.log(`destino caro: ${CARO.name} (${CARO.plan.code}, ₡${CARO.plan.cost})`)

  // Persona de prueba, con su matrícula y su pago aprobado de ₡5.000.
  const { data: m } = await sb.from('members').insert({
    first_name: '[prueba]', last_name: 'Traslado Temporal',
    email: 'traslado.temporal@prueba.theosplace.invalid', is_active: true,
  }).select('id').single()
  const MID = (m as { id: string }).id
  const { data: e } = await sb.from('study_enrollments').insert({
    member_id: MID, group_id: SCJ_DOUGLAS, status: 'enrolled', enrolled_at: new Date().toISOString(),
  }).select('id').single()
  const EID = (e as { id: string }).id
  const { data: pg } = await sb.from('payments').insert({
    member_id: MID, amount: 5000, currency: 'CRC', payment_method: 'comprobante',
    concept: 'matricula', entity_type: 'study_group', enrollment_id: EID,
    study_group_id: SCJ_DOUGLAS, status: 'paid', review_status: 'aprobado',
    payment_date: new Date().toISOString().slice(0, 10), description: 'Matrícula · SCJ',
  }).select('id').single()
  console.log(`creada: miembro ${MID}, matrícula ${EID}, pago ${(pg as {id:string}).id} de ₡5.000 aprobado`)

  const { data: link } = await sb.auth.admin.generateLink({ type: 'magiclink', email: 'ti@theosplace.org' })
  const hashed = (link as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  const b = await chromium.launch()
  const page = await b.newPage()
  await page.goto(`${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=/estudios`, { waitUntil: 'domcontentloaded', timeout: 120_000 })

  console.log('\n── GET: a dónde se puede mover y qué pasa con la plata')
  const g = await page.request.get(`${BASE}/api/studies/enrollments/${EID}/transfer`)
  const opciones = await g.json()
  console.log('origen:', JSON.stringify(opciones.origen))
  console.log(`destinos ofrecidos: ${opciones.destinos?.length}`)
  for (const d of (opciones.destinos ?? []).filter((x: { id: string }) => x.id === CARO.id)) {
    console.log(`   ${d.name} · ₡${d.costo} → cobrar ₡${d.cobrar}, a favor ₡${d.saldo_a_favor}`)
    console.log(`   «${d.mensaje}»`)
  }
  const gratis = (opciones.destinos ?? []).find((x: { costo: number }) => x.costo === 0)
  if (gratis) console.log(`   [gratis] ${gratis.name} → a favor ₡${gratis.saldo_a_favor}: «${gratis.mensaje}»`)

  console.log('\n── PATCH: moverla al caro')
  const r = await page.request.fetch(`${BASE}/api/studies/enrollments/${EID}/transfer`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    data: { target_group_id: CARO.id },
  })
  console.log('HTTP', r.status(), JSON.stringify(await r.json(), null, 1))

  console.log('\n── cómo quedó')
  const { data: fin } = await sb.from('study_enrollments')
    .select('group_id, status, transferred_to').eq('member_id', MID)
  console.table(fin)
  const { data: pagos } = await sb.from('payments')
    .select('amount, status, enrollment_id, study_group_id, description, transfer_note').eq('member_id', MID)
  console.table(pagos)

  await b.close()
  // Limpieza.
  await sb.from('payments').delete().eq('member_id', MID)
  await sb.from('study_enrollments').delete().eq('member_id', MID)
  await sb.from('members').delete().eq('id', MID)
  console.log('\n✓ datos de prueba borrados')
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
