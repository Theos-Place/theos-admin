/**
 * FLUJO · Solicitudes de devolución (AYU-3, interno).
 *
 * Se graba con `[prueba] Fabiola Finanzas` sobre el cobro COBRADO de ₡20.000 de
 * `[prueba] Paco Pagos`. Los datos los arma y los borra `datos-finanzas.ts`.
 *
 * REPETIBLE: el setup borra la devolución de la corrida anterior y devuelve el
 * cobro a 'paid' — registrarla lo pasa a 'refunded' o 'partial_refund'.
 */
import { readFileSync } from 'node:fs'
import { credenciales, type TutorialFlow, type Tools } from './lib'
import { FINANZAS, CLIENTE, ARCHIVO_CLAVE } from './datos-finanzas'

credenciales() // guard @prueba.

const NOTA = '[prueba] tutorial de finanzas'
const clave = () => readFileSync(ARCHIVO_CLAVE, 'utf8').trim()

export const flujo: TutorialFlow = {
  slug: 'devoluciones',
  mdFile: 'solicitudes-de-devolucion.md',
  gifAlt: 'Registrar una devolución sobre un cobro ya cobrado, paso a paso',

  async setup(admin) {
    const { data: m } = await admin.from('members').select('id').eq('email', CLIENTE).maybeSingle()
    if (!m) throw new Error('Corré datos-finanzas.ts crear')
    const memberId = (m as { id: string }).id

    const { data: pagos } = await admin.from('payments').select('id')
      .eq('member_id', memberId).eq('description', NOTA).eq('amount', 20000)
    const ids = ((pagos ?? []) as Array<{ id: string }>).map(p => p.id)
    if (ids.length === 0) throw new Error('No existe el cobro de ₡20.000 — corré datos-finanzas.ts crear')
    // Registrar la devolución deja el cobro en 'refunded'; sin esto la segunda
    // corrida no encuentra nada que devolver (solo los cobrados admiten).
    const { data: dev } = await admin.from('refunds').select('id').in('payment_id', ids)
    const devIds = ((dev ?? []) as Array<{ id: string }>).map(d => d.id)
    if (devIds.length > 0) {
      await admin.from('refunds').delete().in('id', devIds)
      console.log(`    (borradas ${devIds.length} devoluciones anteriores)`)
    }
    await admin.from('payments').update({ status: 'paid' }).in('id', ids)
  },

  async run(t: Tools) {
    // 1 · Entrar como finanzas.
    await t.goto('/login?redirect=/finanzas/pagos')
    await t.badge(1)
    await t.shot('01-login')
    await t.fill('input[placeholder*="ejemplo@correo"]', FINANZAS)
    await t.fill('input[type="password"]', clave())
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/finanzas/pagos**', { timeout: 30_000 })
    await t.pause(1500)

    // 2 · Mostrar montos y quedarse con lo COBRADO: solo eso admite devolución.
    await t.click(t.page.getByRole('button', { name: 'Mostrar montos' }))
    await t.pause(600)
    await t.fill('input[placeholder*="Buscar por miembro"]', 'Paco Pagos')
    await t.pause(1200)
    await t.page.getByLabel('Estado del pago').selectOption('paid')
    await t.pause(1500)
    await t.badge(2)
    await t.shot('02-el-cobro-a-devolver')

    // 3 · "Devolver" abre el modal. Total o parcial, y el motivo.
    await t.click(t.page.getByRole('button', { name: 'Devolver', exact: true }).first())
    await t.page.locator('#motivo').waitFor({ timeout: 20_000 })
    await t.badge(3)
    await t.pause(1000)
    await t.shot('03-total-o-parcial')

    // 4 · Parcial, para que se vea el campo del monto.
    await t.click(t.page.getByRole('button', { name: 'Devolución parcial' }))
    await t.page.locator('#monto-a-devolver').fill('5000')
    await t.page.locator('#motivo').selectOption('Error de cobro')
    await t.badge(4)
    await t.pause(1200)
    await t.shot('04-monto-y-motivo')

    // 5 · Crear. Queda PENDIENTE: el sistema no mueve la plata, la mueve una
    //     persona. Es lo que más se olvida y por eso el paso existe.
    await t.click(t.page.getByRole('button', { name: 'Crear solicitud de devolución' }))
    await t.pause(2500)
    await t.badge(5)
    await t.shot('05-solicitud-creada')

    // 6 · Dónde vive después: Finanzas → Devoluciones, con sus cuatro estados.
    await t.goto('/finanzas/devoluciones')
    await t.pause(2000)
    await t.badge(6)
    await t.shot('06-la-cola-de-devoluciones')
  },

  mdImages: [],
}
