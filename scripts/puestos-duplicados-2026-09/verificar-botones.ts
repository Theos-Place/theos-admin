/** Los botones de editar y borrar tienen que verse SIN pasar el mouse, y en celular. */
import { chromium, devices } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'

const BASE = 'http://localhost:3000'

async function main() {
  const sb = createAdminClient()
  // Un enlace por contexto: el token es de UN solo uso y el primero se lo gasta.
  const nuevoToken = async () => {
    const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: 'ti@theosplace.org' })
    if (error) throw error
    return (data as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  }
  const b = await chromium.launch()

  for (const [nombre, ctxOpts] of [
    ['escritorio', { viewport: { width: 1440, height: 950 } }],
    ['celular', devices['iPhone 13']],
  ] as const) {
    const ctx = await b.newContext(ctxOpts as Parameters<typeof b.newContext>[0])
    const page = await ctx.newPage()
    await page.goto(`${BASE}/auth/confirm?token_hash=${await nuevoToken()}&type=email&next=/servidores/admin`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    await page.getByText('Sedes', { exact: true }).first().click()
    await page.waitForTimeout(800)
    // Sin pasar el mouse por ninguna fila: ¿se ve "Editar" de un comité?
    const lapizComite = page.getByRole('button', { name: /^Editar comité / }).first()
    console.log(`${nombre} · lápiz de un comité visible sin hover: ${await lapizComite.isVisible().catch(() => false)} · opacidad ${await lapizComite.evaluate(el => getComputedStyle(el).opacity).catch(() => 'n/a')}`)

    await page.getByText('Sede Pedregal Jueves', { exact: true }).first().click()
    await page.waitForTimeout(1200)
    const lapiz = page.getByRole('button', { name: /^Editar puesto / }).first()
    const basurero = page.getByRole('button', { name: /^Eliminar puesto / }).first()
    console.log(`${nombre} · lápiz de un puesto visible: ${await lapiz.isVisible().catch(() => false)}`)
    console.log(`${nombre} · basurero de un puesto visible: ${await basurero.isVisible().catch(() => false)}`)
    // isVisible() no mira la opacidad: con opacity-0 daba true igual.
    const opacidad = await lapiz.evaluate(el => getComputedStyle(el).opacity).catch(() => 'n/a')
    console.log(`${nombre} · opacidad real del lápiz: ${opacidad}`)
    // ¿La tabla de comités se sale de su panel?
    const medida = await page.evaluate(() => {
      const tabla = document.querySelector('table')
      const cont = tabla?.parentElement
      return cont ? { visible: cont.clientWidth, real: cont.scrollWidth, sobra: cont.scrollWidth - cont.clientWidth } : null
    })
    console.log(`${nombre} · tabla de comités: ${JSON.stringify(medida)}`)
    await page.screenshot({ path: `scripts/puestos-duplicados-2026-09/out-${nombre}.png` })
    await ctx.close()
  }
  await b.close()
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
