/**
 * FLUJO · Registrar donaciones (AYU-3, interno).
 *
 * Graba el camino de UNA donación suelta, que es el que se usa a diario. El de
 * importar el Excel del banco no se graba: pide un archivo real del banco y el
 * paso que importa —resolver a quién le corresponde cada fila— depende de los
 * nombres que traiga ese archivo. Queda explicado en el artículo y en la
 * infografía.
 *
 * REPETIBLE: el setup borra la donación de la corrida anterior.
 */
import { readFileSync } from 'node:fs'
import { credenciales, type TutorialFlow, type Tools } from './lib'
import { FINANZAS, CLIENTE, ARCHIVO_CLAVE } from './datos-finanzas'

credenciales() // guard @prueba.

const NOTA = '[prueba] tutorial de finanzas'
const clave = () => readFileSync(ARCHIVO_CLAVE, 'utf8').trim()

export const flujo: TutorialFlow = {
  slug: 'donaciones',
  mdFile: 'registrar-donaciones.md',
  gifAlt: 'Registrar una donación una por una, paso a paso',

  async setup(admin) {
    const { data: m } = await admin.from('members').select('id').eq('email', CLIENTE).maybeSingle()
    if (!m) throw new Error('Corré datos-finanzas.ts crear')
    const { error } = await admin.from('donations')
      .delete().eq('member_id', (m as { id: string }).id)
    if (error) throw error
  },

  async run(t: Tools) {
    // 1 · Entrar como finanzas, directo a donaciones.
    await t.goto('/login?redirect=/finanzas/donaciones')
    await t.badge(1)
    await t.shot('01-login')
    await t.fill('input[placeholder*="ejemplo@correo"]', FINANZAS)
    await t.fill('input[type="password"]', clave())
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/finanzas/donaciones**', { timeout: 30_000 })
    await t.pause(2000)
    await t.badge(2)
    await t.shot('02-la-pantalla')

    // 2 · Los dos caminos están arriba a la derecha. Se abre el de una suelta.
    await t.click(t.page.getByRole('button', { name: 'Agregar donación' }))
    await t.page.locator('#don-fecha').waitFor({ timeout: 20_000 })
    await t.badge(3)
    await t.pause(800)
    await t.shot('03-el-formulario')

    // 3 · La persona es lo único obligatorio: una donación sin dueño no sirve.
    //
    // OJO con el selector: la pantalla de atrás tiene SU PROPIO buscador con el
    // mismo placeholder, y sin acotar al modal se llenaba el de atrás. Por eso
    // todo lo de este paso cuelga de `modal`.
    const modal = t.page.locator('div[role="presentation"]')
    await modal.locator('input[placeholder*="Buscar por nombre"]').fill('Paco Pagos')
    await t.pause(2000)
    await t.click(modal.getByText('Paco Pagos').first())
    await t.pause(600)
    await t.badge(4)
    await t.shot('04-la-persona')

    // 4 · Monto y nota. El monto es OPCIONAL y vacío no es cero: vacío dice
    //     "donó, no sabemos cuánto". Acá se llena para que se vea el caso común.
    await modal.locator('#don-monto').fill('25000')
    await modal.locator('#don-nota').fill('Donación para Edificio — Campaña MyH')
    await t.badge(5)
    await t.pause(1000)
    await t.shot('05-monto-y-nota')

    // 5 · Registrar.
    await t.click(modal.getByRole('button', { name: 'Registrar donación' }))
    await t.pause(2500)
    await t.badge(6)
    await t.shot('06-donacion-registrada')
  },

  mdImages: [],
}
