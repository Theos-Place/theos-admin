/**
 * FLUJO 8 · Un tiquete de folletos: crearlo manual y llevarlo por sus estados
 * (Camila Coordinadora, coordinadora de estudios).
 * REPETIBLE: el setup asegura la cuenta de Camila y borra los tiquetes
 * [prueba] de la corrida anterior.
 */
import { crearCuentaDeAcceso } from '../lib/cuentas-de-prueba'
import { credenciales, type TutorialFlow, type Tools } from './lib'

credenciales() // guard @prueba. (las credenciales de Camila van en duro abajo)
export const CAMILA = 'camila.coordinadora@prueba.theosplace.invalid'
const PASSWORD = 'Prueba.Agosto.2026' // contraseña única del seed
const NOTA = '[prueba] Reposición: se dañaron folletos del grupo.'

export const flujo: TutorialFlow = {
  slug: 'folletos',
  mdFile: 'tiquete-de-folletos.md',
  gifAlt: 'El flujo completo: crear el tiquete manual y avanzarlo por sus estados',

  async setup(admin) {
    // Cuenta de la coordinadora (idempotente); external_id con el prefijo del
    // seed para que limpiar-datos-de-prueba la borre con el resto del set.
    await crearCuentaDeAcceso(admin as never, {
      email: CAMILA, password: PASSWORD, nombre: '[prueba] Camila Coordinadora',
      role: 'coordinador_estudios',
      camposMiembro: { external_id: 'PRUEBA-9005', gender: 'F' },
    })
    // Cédula de prueba: sin ella, el banner "Falta tu cédula" sale en las tomas.
    await admin.from('members').update({ cedula: '9-9999-9005' }).eq('email', CAMILA)
    // La cola de folletos es del rol acotado 'folletos' (coordinador_estudios
    // NO trae ese módulo — lo delega). Camila lo lleva además de su rol.
    const { data: m } = await admin.from('members').select('id').eq('email', CAMILA).maybeSingle()
    const camilaId = (m as { id: string }).id
    const { data: rol } = await admin.from('member_roles')
      .select('id').eq('member_id', camilaId).eq('role', 'folletos').maybeSingle()
    if (rol) await admin.from('member_roles').update({ is_active: true }).eq('id', (rol as { id: string }).id)
    else await admin.from('member_roles').insert({ member_id: camilaId, role: 'folletos', is_active: true })
    await admin.from('folleto_requests').delete().ilike('note', '%[prueba]%')
    console.log('    (tiquetes [prueba] de la corrida anterior borrados)')
  },

  async run(t: Tools) {
    // 1 · Login que aterriza en la cola de folletos
    await t.goto('/login?redirect=/estudios/folletos')
    await t.fill('input[placeholder*="ejemplo@correo"]', CAMILA)
    await t.fill('input[type="password"]', PASSWORD)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/estudios/folletos**', { timeout: 30_000 })
    await t.page.getByText('Solicitud de folletos manual').first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1200)
    await t.shot('01-cola')

    // 2 · Crear un tiquete manual (caso especial, fuera del flujo de cierre)
    await t.click(t.page.getByRole('button', { name: /solicitud de folletos manual/i }))
    await t.page.locator('#mf-level').waitFor({ timeout: 15_000 })
    await t.badge(2)
    await t.page.selectOption('#mf-level', 'N2')
    await t.fill('#mf-qty', '10')
    await t.page.selectOption('#mf-sede', { index: 1 })
    // Combobox del dirigente: abrir, buscar y elegir a Dora.
    await t.click(t.page.getByRole('button', { name: 'Dirigente a quien entregar' }))
    await t.fill('input[aria-label="Dirigente a quien entregar"]', 'Dora')
    await t.click(t.page.getByText('[prueba] Dora Dirigente').first())
    await t.fill('#mf-note', NOTA)
    await t.pause(800)
    await t.shot('02-solicitud')

    // 3 · Crear → el tiquete entra a la cola como "Creada"
    await t.click(t.page.getByRole('button', { name: /crear solicitud/i }))
    await t.page.getByText('Creada').first().waitFor({ timeout: 20_000 })
    await t.badge(3)
    await t.pause(1200)
    await t.shot('03-creada')

    // 4 · Avanzar el estado: Creada → En impresión
    await t.click(t.page.getByRole('button', { name: 'En impresión' }).first())
    await t.page.getByText('En impresión').first().waitFor({ timeout: 20_000 })
    await t.badge(4)
    await t.pause(1200)
    await t.shot('04-en-impresion')

    // 5 · En impresión → Enviado / Entregado
    await t.click(t.page.getByRole('button', { name: 'Enviado / Entregado' }).first())
    await t.page.getByText('Enviado / Entregado').first().waitFor({ timeout: 20_000 })
    await t.badge(5)
    await t.pause(1500)
    await t.shot('05-entregado')
  },

  async teardown(admin) {
    await admin.from('folleto_requests').delete().ilike('note', '%[prueba]%')
  },

  mdImages: [],
}
