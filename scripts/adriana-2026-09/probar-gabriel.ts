/** Que Gabriel entre con SU perfil y con el acceso al check-in. */
import { chromium } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'
const BASE = 'http://localhost:3000'
async function main() {
  const sb = createAdminClient()
  const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: 'gabrielalvarezgomez2004@gmail.com' })
  if (error) throw error
  const hashed = (data as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  const b = await chromium.launch()
  const page = await b.newPage()
  await page.goto(`${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=/mi-perfil`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForTimeout(4000)
  const me = await (await page.request.get(`${BASE}/api/auth/me`)).json()
  console.log('entra como:', me.user?.name)
  console.log('roles:', (me.user?.roles ?? []).join(', '))
  console.log('¿tiene perfil?:', me.user?.member_id ? 'sí · ' + me.user.member_id : 'NO')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(1500)
  const enMenu = await page.getByRole('link', { name: 'Check-in' }).first().isVisible().catch(() => false)
  console.log('¿ve Check-in en el menú?:', enMenu ? 'sí' : 'no')
  // Y lo que de verdad importa: ¿puede abrir la pantalla?
  await page.goto(`${BASE}/eventos/checkin`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.waitForTimeout(4000)
  const txt = (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 200)
  console.log('la pantalla de check-in:', txt)
  await b.close()
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
