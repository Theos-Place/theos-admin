/** REP-2 · clic en una barra abre la semana, el enlace la abre directo, y
 *  "volver al año" la cierra. */
import { chromium } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'
const BASE = 'http://localhost:3000'

async function main() {
  const sb = createAdminClient()
  const { data } = await sb.auth.admin.generateLink({ type: 'magiclink', email: 'ti@theosplace.org' })
  const hashed = (data as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  const b = await chromium.launch()
  const page = await b.newPage({ viewport: { width: 1440, height: 1000 } })

  console.log('1) el enlace compartido abre en su semana')
  await page.goto(`${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=${encodeURIComponent('/reportes/asistencia?semana=2025-W37')}`,
    { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForTimeout(7000)
  await page.getByRole('heading', { name: /Semana 37 de 2025/ }).waitFor({ timeout: 20_000 })
  const panel = page.locator('div').filter({ hasText: /^Semana 37 de 2025/ }).last()
  await page.getByText('Por sede').first().waitFor({ timeout: 20_000 })
  await page.waitForTimeout(800)
  console.log('   ✓ abre:', (await panel.innerText()).split('\n').filter(Boolean).slice(0, 12).join(' | '))
  await page.screenshot({ path: 'scripts/adriana-2026-09/out-rep2.png' })

  console.log('\n2) "volver al año" lo cierra y limpia la URL')
  await page.getByRole('button', { name: 'Volver al año' }).click()
  await page.waitForTimeout(800)
  console.log('   URL:', page.url())
  console.log('   ¿queda el panel?', await page.getByRole('heading', { name: /Semana 37 de 2025/ }).isVisible().catch(() => false))

  console.log('\n3) clic en una barra del gráfico')
  const barras = page.locator('.recharts-bar-rectangle')
  console.log('   barras en el gráfico:', await barras.count())
  await barras.nth(30).click()
  await page.waitForTimeout(2500)
  const h = await page.getByRole('heading', { name: /Semana \d+ de \d+/ }).first().innerText().catch(() => '(no abrió)')
  console.log('   abrió:', h, '· URL:', new URL(page.url()).search)
  await b.close()
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
