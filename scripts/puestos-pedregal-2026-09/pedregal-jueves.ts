/**
 * Sede Pedregal Jueves (pedido 2026-09-10):
 *   · quitar los puestos de Cumpleaños (coordinador y colaborador)
 *   · agregar Coordinador de Hospitalidad y Coordinador de Información
 *
 * Se hace POR LA PANTALLA, no con SQL: es la prueba de que el botón nuevo de
 * "crear puesto" funciona de verdad. Entra con la cuenta de admin del usuario.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/puestos-pedregal-2026-09/pedregal-jueves.ts
 *   ... --aplicar
 */
import { chromium } from 'playwright'
import { createAdminClient } from '../../src/lib/supabase/admin'

const CORREO = 'ti@theosplace.org'
const BASE = 'http://localhost:3000'
const PEDREGAL_JUEVES = 'f8748efe-e5ed-49d2-b563-7c0d1797c7c7'
const A_CREAR = ['Coordinador de Hospitalidad', 'Coordinador de Información']

const aplicar = process.argv.includes('--aplicar')

async function main() {
  const sb = createAdminClient()

  // Los de cumpleaños, y CUÁNTA gente pierde su puesto si se borran.
  const { data: pos } = await sb.from('service_positions')
    .select('id, title').eq('area_id', PEDREGAL_JUEVES)
  const cumples = ((pos ?? []) as { id: string; title: string }[])
    .filter(p => /cumplea/i.test(p.title))
  for (const p of cumples) {
    const { count } = await sb.from('volunteers')
      .select('id', { count: 'exact', head: true }).eq('position_id', p.id).eq('status', 'active')
    console.log(`a borrar: "${p.title}" — servidores activos: ${count ?? 0}`)
    // Borrar un puesto con gente adentro le quita el puesto (y los roles que
    // el puesto respalda) a personas reales. Eso se decide, no se asume.
    if ((count ?? 0) > 0) throw new Error(`"${p.title}" tiene gente activa. Abortando: eso hay que decidirlo aparte.`)
  }
  const yaHay = new Set(((pos ?? []) as { title: string }[]).map(p => p.title.toLowerCase()))
  const faltan = A_CREAR.filter(t => !yaHay.has(t.toLowerCase()))
  console.log('a crear:', faltan.length ? faltan.join(', ') : '(ya existen todos)')

  if (!aplicar) { console.log('\nSimulacro. Volvé a correrlo con --aplicar.'); return }

  const { data: link, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: CORREO })
  if (error) throw error
  const hashed = (link as { properties?: { hashed_token?: string } })?.properties?.hashed_token
  const b = await chromium.launch()
  const page = await b.newPage({ viewport: { width: 1440, height: 950 } })
  await page.goto(`${BASE}/auth/confirm?token_hash=${hashed}&type=email&next=/servidores/admin`, { waitUntil: 'networkidle' })

  // Sedes → Sede Pedregal Jueves
  await page.waitForTimeout(2500)
  // La fila del área es un div con un botón adentro; el nombre no es el
  // accessible name completo, así que se busca por texto.
  await page.getByText('Sedes', { exact: true }).first().click()
  await page.getByText('Sede Pedregal Jueves', { exact: true }).first().click()
  await page.getByRole('button', { name: /^Nuevo$/ }).last().waitFor({ timeout: 15_000 })
  console.log('✓ el panel de Puestos ya trae botón "Nuevo"')

  for (const titulo of faltan) {
    await page.getByRole('button', { name: /^Nuevo$/ }).last().click()
    await page.getByLabel('Nombre del puesto').fill(titulo)
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Crear puesto' }).click()
    await page.getByText(/Puesto creado/).first().waitFor({ timeout: 15_000 })
    console.log(`  ✓ creado: ${titulo}`)
    await page.waitForTimeout(1200)
  }

  await page.screenshot({ path: 'scripts/puestos-pedregal-2026-09/out-puestos.png' })
  await b.close()

  // El borrado de los de cumpleaños: por API, con el mismo endpoint de la
  // pantalla. Se hace acá y no con clics porque el confirm pide escribir una
  // palabra y automatizarlo esconde justo lo que ese paso protege.
  for (const p of cumples) {
    const { error: e } = await sb.from('service_positions').delete().eq('id', p.id)
    console.log(e ? `  ✗ ${p.title}: ${e.message}` : `  ✓ borrado: ${p.title}`)
  }
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
