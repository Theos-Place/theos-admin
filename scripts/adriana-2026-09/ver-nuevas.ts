import { chromium } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'
const BASE = 'http://localhost:3000'
const EV = 'd40fad32-5fec-4fb8-91e1-f58e644c711e'
async function main() {
  const sb = createAdminClient()
  const { data } = await sb.auth.admin.generateLink({ type: 'magiclink', email: 'ti@theosplace.org' })
  const hashed = (data as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  const b = await chromium.launch()
  const page = await b.newPage({ viewport: { width: 1400, height: 1000 } })
  await page.goto(`${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=/eventos/${EV}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForTimeout(6000)
  await page.locator('nav, [role=tablist], button').filter({ hasText: /^Reportes$/ }).last().click()
  await page.waitForTimeout(2500)
  const txt = await page.locator('body').innerText()
  for (const linea of txt.split('\n').map(s => s.trim()).filter(Boolean)) {
    if (/nuev|primera|asisten|servidor|participante|%|\d/.test(linea)) console.log('  ', linea)
  }
  await page.screenshot({ path: 'scripts/adriana-2026-09/out-nuevas.png', fullPage: false })
  await b.close()
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
