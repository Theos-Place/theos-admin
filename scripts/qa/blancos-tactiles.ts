/**
 * QA-2 · Blancos táctiles en móvil, en las pantallas que se usan desde un
 * teléfono. Contra STAGING.
 *
 *   QA_RUTAS='["/mis-pagos","/matricula"]' npx tsx scripts/qa/blancos-tactiles.ts
 *
 * axe con WCAG 2.1 no mide el tamaño del blanco (es un criterio de 2.2), así
 * que esto lo mide aparte: todo botón, enlace o control visible de menos de
 * 44×44 px (o 24×24, el mínimo de 2.2 AA) a 375 px de ancho. Los enlaces
 * dentro de un párrafo no cuentan: el criterio los exime.
 */
import { chromium, devices } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

for (const l of readFileSync('.env.staging.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL!.includes(process.env.SUPABASE_STAGING_REF!)) {
  console.error('✗ No es staging.'); process.exit(1)
}
const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3001'
const RUTAS: string[] = JSON.parse(process.env.QA_RUTAS ?? '[]')

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 375, height: 812 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[placeholder*="ejemplo@correo"]', process.env.QA_EMAIL ?? 'ti@theosplace.org')
  await page.fill('input[type="password"]', process.env.SEED_TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  const salida: Record<string, unknown> = {}
  for (const ruta of RUTAS) {
    await page.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 60_000 })
    await page.waitForTimeout(1200)
    const chicos = await page.evaluate(() => {
      const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox]'
      return Array.from(document.querySelectorAll<HTMLElement>(sel))
        .filter(el => {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return false
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.display === 'none') return false
          // Enlace dentro de texto corrido: exento.
          if (el.tagName === 'A' && el.closest('p') && (el.closest('p')!.innerText.length > (el.innerText.length + 20))) return false
          return r.height < 44 || r.width < 44
        })
        .map(el => {
          const r = el.getBoundingClientRect()
          return {
            el: el.tagName.toLowerCase(),
            nombre: (el.getAttribute('aria-label') || el.innerText || (el as HTMLInputElement).placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 40),
            px: `${Math.round(r.width)}×${Math.round(r.height)}`,
            bajo24: r.height < 24 || r.width < 24,
          }
        })
    })
    salida[ruta] = { total: chicos.length, bajo24: chicos.filter(c => c.bajo24).length, ejemplos: chicos.slice(0, 12) }
    console.log(`▶ ${ruta}: ${chicos.length} blancos < 44px · ${chicos.filter(c => c.bajo24).length} < 24px`)
  }
  await browser.close()
  writeFileSync('docs/qa-2026-10/blancos-tactiles.json', JSON.stringify(salida, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
