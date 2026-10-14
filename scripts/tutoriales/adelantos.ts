/**
 * FLUJO · Adelantos de comida por sede (FIN-12).
 *
 * Graba el mes de UNA sede visto por finanzas: abrir el mes, registrar la
 * factura de una semana y ver cómo baja el saldo. El cierre no se graba: es
 * un botón y queda dicho en la infografía.
 *
 * QUIÉN LO GRABA: Fabiola Finanzas (cuenta [prueba] con el rol finanzas, que
 * ve todas las sedes). Se usa la sede «Sede Antares» porque ya tiene
 * presupuesto fijado en producción; si no lo tuviera, el setup lo pone.
 *
 * REPETIBLE Y LIMPIO: el setup y el teardown borran el mes de prueba (y sus
 * facturas) para que el mes real de Antares no herede nada del tutorial.
 * Mientras se graba, el mes existe de verdad: no grabar un día en que la
 * sede esté registrando su mes.
 */
import { readFileSync } from 'node:fs'
import { credenciales, type TutorialFlow, type Tools } from './lib'
import { FINANZAS, ARCHIVO_CLAVE } from './datos-finanzas'

credenciales() // guard @prueba.

const SEDE = 'antares'
const clave = () => readFileSync(ARCHIVO_CLAVE, 'utf8').trim()
const mesActual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }).slice(0, 7)

async function borrarMesDePrueba(admin: Parameters<NonNullable<TutorialFlow['setup']>>[0]) {
  const { data } = await admin.from('sede_advances').select('id').eq('sede_code', SEDE).eq('mes', mesActual())
  for (const a of (data ?? []) as { id: string }[]) {
    await admin.from('sede_advance_expenses').delete().eq('advance_id', a.id)
    await admin.from('sede_advances').delete().eq('id', a.id)
  }
}

export const flujo: TutorialFlow = {
  slug: 'adelantos',
  mdFile: 'adelantos-de-comida.md',
  gifAlt: 'Abrir el mes de una sede y registrar la factura de una semana',

  async setup(admin) {
    await borrarMesDePrueba(admin)
    const { data: p } = await admin.from('sede_advance_budgets').select('monto').eq('sede_code', SEDE).maybeSingle()
    if (!p) {
      const { error } = await admin.from('sede_advance_budgets').insert({ sede_code: SEDE, monto: 60000, moneda: 'CRC' })
      if (error) throw error
    }
  },

  async teardown(admin) {
    await borrarMesDePrueba(admin)
  },

  async run(t: Tools) {
    // 1 · Entrar y abrir Finanzas → Adelantos de comida.
    await t.goto('/login?redirect=/finanzas/adelantos')
    await t.badge(1)
    await t.shot('01-login')
    await t.fill('input[placeholder*="ejemplo@correo"]', FINANZAS)
    await t.fill('input[type="password"]', clave())
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/finanzas/adelantos**', { timeout: 30_000 })
    await t.pause(2000)
    await t.badge(2)
    await t.shot('02-las-sedes')

    // 2 · Abrir el mes de la sede (nace con el presupuesto completo).
    const filaAntares = t.page.locator('div', { hasText: /^Sede Antares/ }).filter({ has: t.page.getByRole('button', { name: 'Abrir mes' }) }).first()
    await t.click(filaAntares.getByRole('button', { name: 'Abrir mes' }))
    await t.page.getByRole('heading', { name: /Sede Antares ·/ }).waitFor({ timeout: 20_000 })
    await t.pause(1200)
    await t.badge(3)
    await t.shot('03-mes-abierto')

    // 3 · Registrar la factura de una semana.
    await t.click(t.page.getByRole('button', { name: /^\s*Factura$/ }))
    await t.page.locator('#f-semana').waitFor({ timeout: 20_000 })
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' })
    await t.fill('#f-semana', hoy)
    await t.fill('#f-fecha', hoy)
    await t.fill('#f-enc', 'Karina')
    await t.fill('#f-prov', 'Panadería La Espiga')
    await t.fill('#f-num', '00100001010000012345')
    await t.fill('#f-monto', '6500')
    await t.badge(4)
    await t.pause(800)
    await t.shot('04-la-factura')

    // 4 · Guardar: la semana aparece y el saldo baja.
    await t.click(t.page.getByRole('button', { name: 'Guardar factura' }))
    await t.pause(2500)
    await t.badge(5)
    await t.shot('05-el-saldo')
  },

  mdImages: [],
}
