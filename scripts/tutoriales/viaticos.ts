/**
 * FLUJO · Pedir viáticos para un viaje (FIN-11).
 *
 * Graba el camino del EMPLEADO: pedir el viaje, poner el presupuesto y
 * enviarlo a revisión. La revisión de finanzas y la aprobación de dirección
 * no se graban: son dos firmas con un botón cada una y quedan dichas en la
 * infografía.
 *
 * QUIÉN LO GRABA: Fabiola Finanzas, la cuenta [prueba] de finanzas, a la que
 * el setup le crea una FICHA DE EMPLEADO (sin ficha nadie puede pedir un
 * viaje: así es la regla, y por eso el setup la crea y el teardown la borra).
 *
 * REPETIBLE: el setup borra los viajes de prueba de la corrida anterior.
 *
 * Corre contra PRODUCCIÓN: el código de viáticos tiene que estar desplegado.
 */
import { readFileSync } from 'node:fs'
import { credenciales, type TutorialFlow, type Tools } from './lib'
import { FINANZAS, ARCHIVO_CLAVE } from './datos-finanzas'

credenciales() // guard @prueba.

const DESTINO = '[prueba] Liberia, Guanacaste'
const clave = () => readFileSync(ARCHIVO_CLAVE, 'utf8').trim()

async function fichaDeFinanzas(admin: Parameters<NonNullable<TutorialFlow['setup']>>[0]): Promise<string> {
  const { data: m } = await admin.from('members').select('id').eq('email', FINANZAS).maybeSingle()
  if (!m) throw new Error('Corré datos-finanzas.ts crear')
  return (m as { id: string }).id
}

export const flujo: TutorialFlow = {
  slug: 'viaticos',
  mdFile: 'solicitar-viaticos.md',
  gifAlt: 'Pedir un viaje con viáticos, paso a paso: solicitud, presupuesto y envío',

  async setup(admin) {
    const id = await fichaDeFinanzas(admin)
    // Viajes de la corrida anterior.
    await admin.from('travel_requests').delete().eq('member_id', id).eq('destino', DESTINO)
    // Ficha de empleado: sin ella no aparece «Viáticos» en el menú.
    const { data: emp } = await admin.from('employees').select('id').eq('member_id', id).maybeSingle()
    if (!emp) {
      const { error } = await admin.from('employees').insert({
        member_id: id, start_date: '2026-01-06', status: 'active',
        notes: '[prueba] ficha del tutorial de viáticos — se borra sola',
      })
      if (error) throw error
    }
  },

  async teardown(admin) {
    const id = await fichaDeFinanzas(admin)
    await admin.from('travel_requests').delete().eq('member_id', id).eq('destino', DESTINO)
    await admin.from('employees').delete().eq('member_id', id).like('notes', '[prueba]%')
  },

  async run(t: Tools) {
    // 1 · Entrar y abrir Empleados → Viáticos.
    await t.goto('/login?redirect=/empleados/viajes')
    await t.badge(1)
    await t.shot('01-login')
    await t.fill('input[placeholder*="ejemplo@correo"]', FINANZAS)
    await t.fill('input[type="password"]', clave())
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/empleados/viajes**', { timeout: 30_000 })
    await t.pause(2000)
    await t.badge(2)
    await t.shot('02-mis-viajes')

    // 2 · Nuevo viaje: adónde, cuándo, para qué.
    await t.click(t.page.getByRole('link', { name: /nuevo viaje/i }))
    await t.page.locator('#v-destino').waitFor({ timeout: 20_000 })
    await t.page.locator('#v-tipo').selectOption('trabajo')
    await t.page.locator('#v-alcance').selectOption('nacional')
    await t.fill('#v-destino', DESTINO)
    await t.fill('#v-sale', '2026-11-10T07:00')
    await t.fill('#v-vuelve', '2026-11-11T18:00')
    await t.fill('#v-objetivo', 'Capacitar al comité de la sede en el check-in con familia.')
    await t.badge(3)
    await t.pause(800)
    await t.shot('03-el-viaje')

    // 3 · Presupuesto: una línea por gasto, y el adelanto.
    await t.click(t.page.getByRole('button', { name: /agregar rubro/i }))
    await t.page.locator('#l-rubro-0').waitFor({ timeout: 10_000 })
    await t.fill('#l-desc-0', 'Bus San José – Liberia, ida y vuelta')
    await t.fill('#l-cant-0', '2')
    await t.fill('#l-tar-0', '6500')
    await t.fill('#v-ant', '13000')
    await t.badge(4)
    await t.pause(800)
    await t.shot('04-el-presupuesto')

    // 4 · Guardar: queda como borrador y abre el expediente.
    await t.click(t.page.getByRole('button', { name: 'Crear borrador' }))
    await t.page.waitForURL(/\/empleados\/viajes\/[0-9a-f-]{36}$/, { timeout: 30_000 })
    await t.pause(1500)
    await t.badge(5)
    await t.shot('05-el-expediente')

    // 5 · Enviar a revisión: desde acá lo toma finanzas.
    await t.click(t.page.getByRole('button', { name: 'Enviar a revisión' }))
    await t.pause(2500)
    await t.badge(6)
    await t.shot('06-enviado')
  },

  mdImages: [],
}
