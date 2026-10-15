/**
 * QA-2 · Un cambio de grupo con pago previo NO genera un cobro nuevo (el bug
 * de Kristel Guzmán, 2026-10-07). Contra STAGING, con la cuenta qa.roles.
 * Crea matrícula + pago cancelado, la mueve por el endpoint como admin, revisa
 * y limpia. Ejecutar: npx tsx scripts/qa/probar-traslado.ts
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.staging.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SB.includes(process.env.SUPABASE_STAGING_REF!)) throw new Error('no es staging')
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const rest = async (path: string, init: RequestInit = {}) => { const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: H }); const t = await r.text(); if (!r.ok) throw new Error(path + ' ' + t); return t ? JSON.parse(t) : null }
const QA = 'b4f09924-3cd4-4103-a502-625e7507f324'
const DESDE = 'a2ae370e-6f0e-42d8-9cd7-9192196abb60', HACIA = '98dc0b96-25d5-44ed-a9cc-e5b4aafc2604'
async function limpiar() {
  await rest(`payments?member_id=eq.${QA}`, { method: 'DELETE' })
  await rest(`study_enrollments?member_id=eq.${QA}&group_id=in.(${DESDE},${HACIA})`, { method: 'DELETE' })
}
async function main() {
  await limpiar()
  const plan = (await rest(`study_groups?select=plan_id&id=eq.${DESDE}`))[0].plan_id
  const [enr] = await rest('study_enrollments', { method: 'POST', body: JSON.stringify({ member_id: QA, group_id: DESDE, plan_id: plan, status: 'enrolled' }) })
  await rest('payments', { method: 'POST', body: JSON.stringify({ member_id: QA, amount: 5000, currency: 'CRC', concept: 'matricula', entity_type: 'study_group', study_group_id: DESDE, enrollment_id: enr.id, status: 'paid', payment_method: 'comprobante', paid_at: new Date().toISOString(), description: '[prueba] QA-2 traslado' }) })
  const b = await chromium.launch(); const page = await (await b.newContext()).newPage()
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' })
  await page.fill('input[placeholder*="ejemplo@correo"]', 'ti@theosplace.org')
  await page.fill('input[type="password"]', process.env.SEED_TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'))
  const res = await page.evaluate(async ([id, hacia]) => { const r = await fetch(`/api/studies/enrollments/${id}/transfer`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_group_id: hacia }) }); return { st: r.status, body: await r.json() } }, [enr.id, HACIA])
  await b.close()
  const pagos = await rest(`payments?select=status,amount,study_group_id,description&member_id=eq.${QA}`)
  console.log('respuesta:', res.st, JSON.stringify(res.body).slice(0, 200))
  console.log('pagos después:', JSON.stringify(pagos))
  const enDestino = pagos.filter((p: { study_group_id: string; status: string }) => p.study_group_id === HACIA)
  const pendientes = pagos.filter((p: { status: string }) => p.status === 'pending')
  console.log(enDestino.length === 1 && pendientes.length === 0 ? '✓ el pago viajó y no hay cobro nuevo' : '✗ NO pasó')
  await limpiar()
  console.log('limpio')
}
main().catch(async e => { console.error(e); await limpiar(); process.exit(1) })
