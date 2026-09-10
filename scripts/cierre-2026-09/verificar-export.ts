/** EVE-9 · Baja el Excel de asistentes de un evento real y lo describe. */
import { chromium } from 'playwright'
import ExcelJS from 'exceljs'
import { createAdminClient } from '../../src/lib/supabase/admin'

const CORREO = 'evelyn.eventos@prueba.theosplace.invalid'
const BASE = 'http://localhost:3000'

async function main() {
  const s = createAdminClient()
  // Un evento con check-ins de verdad.
  const { data: chk } = await s.from('event_checkins').select('event_id').limit(2000)
  const conteo = new Map<string, number>()
  for (const c of (chk ?? []) as { event_id: string }[]) conteo.set(c.event_id, (conteo.get(c.event_id) ?? 0) + 1)
  const [eventId, n] = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]
  const { data: ev } = await s.from('events').select('title, requires_registration').eq('id', eventId).maybeSingle()
  console.log(`evento: ${(ev as {title:string}).title} · ${n} check-ins · inscripción: ${(ev as {requires_registration:boolean}).requires_registration}`)

  // Con encargado_eventos, para probar el gate de la persona que menos permisos tiene.
  const { data: link, error } = await s.auth.admin.generateLink({ type: 'magiclink', email: CORREO })
  if (error) throw error
  const hashed = (link as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=/eventos`, { waitUntil: 'networkidle' })

  const r = await page.request.get(`${BASE}/api/events/${eventId}/attendees/export`)
  console.log('HTTP', r.status(), r.headers()['content-type']?.slice(0, 60))
  if (r.status() !== 200) { console.log(await r.text()); await browser.close(); process.exit(1) }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await r.body())
  const ws = wb.worksheets[0]
  console.log('hoja:', ws.name, '· filas:', ws.rowCount)
  const filas: string[][] = []
  ws.eachRow((row, i) => { if (i <= 6 || i === ws.rowCount) filas.push((row.values as unknown[]).slice(1).map(v => {
    if (v instanceof Date) return v.toISOString().slice(0, 16).replace('T', ' ')
    return String(v ?? '')
  })) })
  for (const f of filas) console.log('  ' + f.join(' | '))
  console.log('\nlas filas con algo que atender:')
  ws.eachRow((row, i) => {
    if (i === 1) return
    const v = (row.values as unknown[]).slice(1).map(x => String(x ?? ''))
    if (v[9] && v[9] !== '—') console.log(`  ${v[0]} · alergia: ${v[9]} · restricción: ${v[10]}`)
  })
  // GATE: un miembro cualquiera NO puede bajar alergias ajenas.
  const p2 = await browser.newPage()
  const { data: l2 } = await s.auth.admin.generateLink({ type: 'magiclink', email: 'pablo.pendiente@prueba.theosplace.invalid' })
  const h2 = (l2 as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  await p2.goto(`${BASE}/auth/confirm?token_hash=${h2}&type=email&next=/mi-perfil`, { waitUntil: 'networkidle' })
  const r2 = await p2.request.get(`${BASE}/api/events/${eventId}/attendees/export`)
  console.log('\ncon rol solo miembro →', r2.status(), (await r2.text()).slice(0, 90))

  await browser.close()
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
