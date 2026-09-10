/** La lista del grupo de Douglas: ¿cuántas filas se ven, y con el botón? */
import { chromium } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'
const G = 'f9fb64b1-e42f-4a3f-950e-1200480ac5c7'
const BASE = 'http://localhost:3000'
async function main() {
  const sb = createAdminClient()
  const { data } = await sb.auth.admin.generateLink({ type: 'magiclink', email: 'ti@theosplace.org' })
  const hashed = (data as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  const b = await chromium.launch()
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=/estudios/grupos/${G}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForTimeout(6000)
  const filas = () => page.locator('table tbody tr').count()
  const encabezado = () => page.getByText(/inscritos de \d+ lugares/).first().innerText()
  console.log('encabezado:', await encabezado())
  console.log('filas en la tabla:', await filas(), '← antes eran 8 con el encabezado diciendo 7')
  const boton = page.getByRole('button', { name: /retirado/i }).first()
  console.log('botón:', await boton.innerText())
  await page.screenshot({ path: 'scripts/adriana-2026-09/out-roster-sin.png' })
  await boton.click()
  await page.waitForTimeout(600)
  console.log('tras tocarlo → filas:', await filas(), '| botón:', await boton.innerText())
  await page.screenshot({ path: 'scripts/adriana-2026-09/out-roster-con.png' })
  await b.close()
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
