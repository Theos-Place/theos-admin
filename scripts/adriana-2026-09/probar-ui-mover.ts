/** El flujo completo por la pantalla: abrir el modal, elegir destino, mover. */
import { chromium } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'
const BASE = 'http://localhost:3000'
const SCJ = 'f9fb64b1-e42f-4a3f-950e-1200480ac5c7'

async function main() {
  const sb = createAdminClient()
  const { data: m } = await sb.from('members').insert({
    first_name: '[prueba]', last_name: 'Mover Pantalla',
    email: 'mover.pantalla@prueba.theosplace.invalid', is_active: true,
  }).select('id').single()
  const MID = (m as { id: string }).id
  const { data: e } = await sb.from('study_enrollments').insert({
    member_id: MID, group_id: SCJ, status: 'enrolled', enrolled_at: new Date().toISOString(),
  }).select('id').single()
  const EID = (e as { id: string }).id
  await sb.from('payments').insert({
    member_id: MID, amount: 5000, currency: 'CRC', payment_method: 'comprobante',
    concept: 'matricula', entity_type: 'study_group', enrollment_id: EID, study_group_id: SCJ,
    status: 'paid', review_status: 'aprobado', payment_date: new Date().toISOString().slice(0, 10),
    description: 'Matrícula · SCJ',
  })

  const { data: link } = await sb.auth.admin.generateLink({ type: 'magiclink', email: 'ti@theosplace.org' })
  const hashed = (link as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  const b = await chromium.launch()
  const page = await b.newPage({ viewport: { width: 1280, height: 950 } })
  await page.goto(`${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=/estudios/grupos/${SCJ}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForTimeout(5000)

  // La tabla anida filas; se toma la fila más específica que contiene el nombre.
  const fila = page.locator('tbody tr', { hasText: 'Mover Pantalla' }).last()
  await fila.getByRole('button', { name: 'Mover de grupo…' }).first().click()
  await page.getByRole('heading', { name: /Mover a .* de grupo/ }).waitFor({ timeout: 15_000 })
  console.log('✓ el modal abre:', await page.getByRole('heading', { name: /Mover a .* de grupo/ }).innerText())

  // Buscar un grupo caro (Panorama, ₡20.000) para ver el aviso del cobro.
  await page.getByLabel(/Grupo destino/).fill('PAN —')
  await page.waitForTimeout(500)
  const opcion = page.locator('button', { hasText: /^PAN — / }).first()
  console.log('opción:', (await opcion.innerText()).replace(/\n/g, ' · '))
  await opcion.click()
  await page.waitForTimeout(400)
  const caja = page.locator('div.rounded-xl.bg-surface-low').last()
  console.log('\nconfirmación que ve el coordinador:')
  console.log('   ' + (await caja.innerText()).split('\n').join('\n   '))
  await page.screenshot({ path: 'scripts/adriana-2026-09/out-mover.png' })

  page.on('response', async r => {
    if (r.url().includes('/transfer') && r.request().method() === 'PATCH') {
      console.log('\nPATCH →', r.status(), (await r.text()).slice(0, 200))
    }
  })
  console.log('\nmatrícula ANTES de mover:', JSON.stringify(
    (await sb.from('study_enrollments').select('id, group_id, status').eq('member_id', MID)).data))
  await page.getByRole('button', { name: 'Mover de grupo', exact: true }).click()
  await page.waitForTimeout(4000)
  const body = await page.locator('body').innerText()
  const aviso = body.split('\n').find(l => l.includes('transferida') || l.includes('cobro pendiente'))
  console.log('\naviso tras mover:', aviso ?? '(no encontrado)')

  const { data: fin } = await sb.from('study_enrollments').select('group_id, status').eq('member_id', MID)
  console.log('matrículas:', JSON.stringify(fin))
  const { data: pagos } = await sb.from('payments').select('amount, status').eq('member_id', MID)
  console.log('pagos:', JSON.stringify(pagos))

  await b.close()
  await sb.from('payments').delete().eq('member_id', MID)
  await sb.from('study_enrollments').delete().eq('member_id', MID)
  await sb.from('members').delete().eq('id', MID)
  console.log('✓ limpio')
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
