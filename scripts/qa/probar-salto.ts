/**
 * QA-2/M4 · «Saltar al contenido»: el primer Tab lo enfoca, se ve, y Enter +
 * Tab lleva a lo primero de <main>. Contra STAGING.
 *   npx tsx scripts/qa/probar-salto.ts
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.staging.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL!.includes(process.env.SUPABASE_STAGING_REF!)) { console.error('✗ No es staging.'); process.exit(1) }
const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3001'
const RUTAS = ['/finanzas/reportes', '/finanzas/pagos', '/estudios/dirigentes', '/miembros', '/eventos']
async function main() {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder*="ejemplo@correo"]', process.env.QA_EMAIL ?? 'ti@theosplace.org')
  await page.fill('input[type="password"]', process.env.SEED_TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  let fallas = 0
  for (const ruta of RUTAS) {
    await page.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.waitForTimeout(1200)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press('Tab')
    const primero = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      const r = el.getBoundingClientRect()
      return { texto: el.innerText?.trim(), visible: r.width > 20 && r.height > 10 }
    })
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    const despues = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      return { enMain: !!el.closest('main'), texto: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40) }
    })
    const ok = primero.texto === 'Saltar al contenido' && primero.visible && despues.enMain
    if (!ok) fallas++
    console.log(`${ok ? '✓' : '✗'} ${ruta}: 1.er Tab «${primero.texto}» (${primero.visible ? 'visible' : 'NO visible'}) → Enter, Tab → ${despues.enMain ? 'en <main>' : 'FUERA de main'}: «${despues.texto}»`)
  }
  await browser.close()
  process.exitCode = fallas ? 1 : 0
}
main().catch(e => { console.error(e); process.exit(1) })
