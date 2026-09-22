/**
 * FLUJO · Planes de pago: partir un cobro en tractos (AYU-3, interno).
 *
 * Se graba con `[prueba] Fabiola Finanzas` sobre el cobro pendiente de
 * `[prueba] Paco Pagos`. Los dos los crea y los borra
 * `scripts/tutoriales/datos-finanzas.ts`, que explica por qué esa cuenta lleva
 * contraseña aleatoria y se borra al terminar.
 *
 * REPETIBLE: el setup deshace el arreglo de la corrida anterior y devuelve el
 * cobro a pendiente y sin tractos.
 */
import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { credenciales, type TutorialFlow, type Tools } from './lib'
import { FINANZAS, CLIENTE, ARCHIVO_CLAVE } from './datos-finanzas'

credenciales() // guard @prueba.

const NOTA = '[prueba] tutorial de finanzas'
const clave = () => readFileSync(ARCHIVO_CLAVE, 'utf8').trim()

async function cobroPendiente(admin: SupabaseClient): Promise<string> {
  const { data: m } = await admin.from('members').select('id').eq('email', CLIENTE).maybeSingle()
  if (!m) throw new Error('No existe el cliente de prueba — corré datos-finanzas.ts crear')
  const { data: p } = await admin.from('payments').select('id')
    .eq('member_id', (m as { id: string }).id).eq('description', NOTA)
    .eq('amount', 60000).limit(1).maybeSingle()
  if (!p) throw new Error('No existe el cobro de ₡60.000 — corré datos-finanzas.ts crear')
  return (p as { id: string }).id
}

export const flujo: TutorialFlow = {
  slug: 'planes-de-pago',
  mdFile: 'planes-de-pago.md',
  gifAlt: 'Partir un cobro pendiente en tractos, paso a paso',

  async setup(admin) {
    const { data: m } = await admin.from('members').select('id').eq('email', CLIENTE).maybeSingle()
    if (!m) throw new Error('Corré datos-finanzas.ts crear')
    const memberId = (m as { id: string }).id
    // DESHACER EL ARREGLO ANTERIOR. El primer tracto REUSA la fila del cobro
    // original, así que después de una corrida el de ₡60.000 ya no existe como
    // tal. Dos intentos de "restaurar la fila original" fallaron porque cuál es
    // esa fila depende de cómo numere `createPaymentPlan`, y adivinarlo cuesta
    // una corrida cada vez.
    //
    // Así que no se restaura: se borra todo el arreglo y se RECREA el cobro
    // desde cero. Es un dato de prueba, no hay historia que conservar.
    const { data: planes } = await admin.from('payment_plans').select('id').eq('member_id', memberId)
    const planIds = ((planes ?? []) as Array<{ id: string }>).map(p => p.id)
    if (planIds.length > 0) {
      await admin.from('payments').delete().in('payment_plan_id', planIds)
      await admin.from('payment_plans').delete().in('id', planIds)
      console.log(`    (borrado el arreglo anterior: ${planIds.length})`)
    }

    const { data: pend } = await admin.from('payments').select('id')
      .eq('member_id', memberId).eq('description', NOTA).eq('status', 'pending').maybeSingle()
    if (!pend) {
      const { data: matricula } = await admin.from('study_enrollments')
        .select('id, group_id').eq('member_id', memberId).eq('notes', NOTA).maybeSingle()
      if (!matricula) throw new Error('No existe la matrícula — corré datos-finanzas.ts crear')
      const mat = matricula as { id: string; group_id: string }
      const { error } = await admin.from('payments').insert({
        member_id: memberId, currency: 'CRC', description: NOTA, concept: 'matricula',
        enrollment_id: mat.id, study_group_id: mat.group_id,
        amount: 60000, status: 'pending',
      })
      if (error) throw error
      console.log('    (cobro de ₡60.000 recreado)')
    }

    await cobroPendiente(admin)
  },

  async run(t: Tools) {
    // 1 · Entrar como finanzas y abrir la cola de pagos.
    await t.goto('/login?redirect=/finanzas/pagos')
    await t.badge(1)
    await t.shot('01-login')
    await t.fill('input[placeholder*="ejemplo@correo"]', FINANZAS)
    await t.fill('input[type="password"]', clave())
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/finanzas/pagos**', { timeout: 30_000 })
    await t.pause(1500)

    // 2 · Los montos vienen OCULTOS por defecto (se ve la pantalla en una
    //     oficina compartida). Para un tutorial de finanzas hay que mostrarlos.
    await t.click(t.page.getByRole('button', { name: 'Mostrar montos' }))
    await t.pause(600)

    // 3 · Buscar a la persona y quedarse solo con lo pendiente: un arreglo se
    //     hace sobre un cobro que todavía no se cobró.
    await t.fill('input[placeholder*="Buscar por miembro"]', 'Paco Pagos')
    await t.pause(1200)
    await t.page.getByLabel('Estado del pago').selectOption('pending')
    await t.pause(1500)
    await t.badge(2)
    await t.shot('02-buscar-el-cobro')

    // 4 · Abrir el detalle. Ya solo queda el pendiente.
    //
    // Los dos anchos abren distinto y hay que contemplarlo: en escritorio la
    // fila trae un botón "Abrir", y en móvil la TARJETA ENTERA es el botón.
    // Buscar solo "Abrir" funcionaba en desktop y en móvil dejaba la grabación
    // esperando un modal que nunca abría.
    // `exact: true` NO es opcional acá: por defecto Playwright matchea por
    // SUBCADENA, y "Abrir" pescaba el botón "Abrir menú" de la topbar. El clic
    // desplegaba el menú lateral y la grabación se quedaba esperando un modal
    // que nunca iba a abrir.
    const botonAbrir = t.page.getByRole('button', { name: 'Abrir', exact: true })
    const tarjeta = t.page.getByRole('button').filter({ hasText: 'Paco Pagos' })
    await t.click((await botonAbrir.count()) > 0 ? botonAbrir.first() : tarjeta.first())
    // El detalle es un Modal: hay que esperar a que el overlay termine de
    // montarse o el clic siguiente se lo come él.
    const modal = t.page.locator('div[role="presentation"]')
    await modal.waitFor({ timeout: 20_000 })
    const convertir = modal.getByRole('button', { name: 'Convertir en arreglo de pago' })
    await convertir.waitFor({ timeout: 20_000 })
    await t.badge(3)
    await t.pause(1000)
    await t.shot('03-detalle-del-cobro')

    // 5 · El panel: en cuántos tractos y desde cuándo.
    await t.click(convertir)
    await t.page.locator('#plan-tractos').waitFor({ timeout: 10_000 })
    await t.page.locator('#plan-tractos').fill('3')
    await t.fill('#plan-notas', 'Acordado por teléfono con la persona')
    await t.badge(4)
    await t.pause(1200)
    await t.shot('04-armar-el-arreglo')

    // 6 · Crear. Los tractos aparecen como cobros normales en la misma cola.
    await t.click(t.page.getByRole('button', { name: 'Crear arreglo' }))
    await t.pause(2500)
    await t.badge(5)
    await t.shot('05-tractos-creados')
  },

  mdImages: [],
}
