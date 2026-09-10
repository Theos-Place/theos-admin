/**
 * EVE-10 · Prueba visual: la ficha de un grupo cerrado dice cuándo se cerró.
 * Entra con la cuenta de prueba de coordinación por enlace de un solo uso
 * (nunca imprime el enlace ni la contraseña).
 */
import { chromium } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'

const CORREO = 'camila.coordinadora@prueba.theosplace.invalid'
const GRUPO_CERRADO = '0e416add-b74f-42cd-a4fd-88c42da4fd59' // Nivel 3. Floriana Fonseca. Junio 2026
const BASE = 'http://localhost:3000'

async function main() {
  const s = createAdminClient()
  const { data, error } = await s.auth.admin.generateLink({ type: 'magiclink', email: CORREO })
  if (error) throw error
  const hashed = (data as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  if (!hashed) throw new Error('sin hashed_token')

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const confirm = `${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=/estudios/grupos/${GRUPO_CERRADO}`
  await page.goto(confirm, { waitUntil: 'networkidle' })
  await page.goto(`${BASE}/estudios/grupos/${GRUPO_CERRADO}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  console.log('URL:', page.url())
  console.log('TEXTO:', (await page.locator('body').innerText()).slice(0, 600))
  await page.getByRole('button', { name: 'Información' }).click()
  await page.getByText('Se cerró').first().waitFor({ timeout: 15_000 })
  const bloque = await page.getByText('Se cerró').first().locator('..').innerText()
  console.log('✓ la ficha lo muestra:\n' + bloque.split('\n').map(l => '   ' + l).join('\n'))
  await page.screenshot({ path: 'scripts/cierre-2026-09/out-grupo-cerrado.png', fullPage: false })
  await browser.close()
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
