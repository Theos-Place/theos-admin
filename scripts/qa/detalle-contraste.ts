/**
 * QA · El detalle de axe para el contraste de UNA pantalla: color de letra,
 * fondo que axe calculó y el ratio. Para entender un hallazgo que la cuenta
 * con contrast.ts dice que pasa. Contra STAGING.
 *   QA_RUTA=/estudios/plan npx tsx scripts/qa/detalle-contraste.ts
 */
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.staging.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL!.includes(process.env.SUPABASE_STAGING_REF!)) { console.error('✗ No es staging.'); process.exit(1) }
const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3001'
async function main() {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: Number(process.env.QA_W ?? 1280), height: 900 } })).newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder*="ejemplo@correo"]', process.env.QA_EMAIL ?? 'ti@theosplace.org')
  await page.fill('input[type="password"]', process.env.SEED_TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  await page.goto(BASE + process.env.QA_RUTA, { waitUntil: 'load', timeout: 60_000 })
  await page.waitForTimeout(2500)
  const r = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  for (const v of r.violations) for (const n of v.nodes.slice(0, Number(process.env.QA_N ?? 8))) {
    const d = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number; fontSize?: string }
    console.log(`${d.contrastRatio} · letra ${d.fgColor} · fondo ${d.bgColor} · ${d.fontSize} · ${n.target.join(' ')} · ${n.html.replace(/\s+/g, ' ').slice(0, 90)}`)
  }
  await browser.close()
}
main().catch(e => { console.error(e); process.exit(1) })
