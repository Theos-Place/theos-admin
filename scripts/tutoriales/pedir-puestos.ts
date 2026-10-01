/**
 * FLUJO · Solicitar puestos de servicio para un comité
 * (Sofía Servidores, coordinadora de servidores).
 *
 * POR QUÉ ESTE Y NO «aplicar a una vacante»: son dos cosas distintas que se
 * confunden. Aplicar es lo que hace QUIEN QUIERE SERVIR; pedir puestos es lo
 * que hace el comité para abrir esos cupos. Sin cupos abiertos no hay a qué
 * aplicar, así que éste viene antes en el orden real.
 *
 * REPETIBLE a propósito, y de dos formas:
 *  · el setup asegura la cuenta y borra las solicitudes [prueba] anteriores;
 *  · se graba con una cuenta que ADMINISTRA servidores, porque la pantalla
 *    deja enviar fuera de la ventana mensual a quien administra. Grabarlo con
 *    un líder de comité solo funcionaría los días que la ventana está
 *    abierta, y un tutorial que solo se puede regrabar una semana al mes se
 *    queda viejo.
 */
import { crearCuentaDeAcceso } from '../lib/cuentas-de-prueba'
import { credenciales, type TutorialFlow, type Tools } from './lib'

credenciales() // guard @prueba.
export const SOFIA = 'sofia.servidores@prueba.theosplace.invalid'
const PASSWORD = 'Prueba.Agosto.2026' // contraseña única del seed

/**
 * Cuándo empezó esta corrida. Marca la ventana de lo que hay que limpiar.
 *
 * SE FIJA UNA SOLA VEZ, y por eso no va dentro de `setup`: el runner llama a
 * `setup` DOS veces, una por cada viewport («re-setup para el segundo
 * viewport»). Fijarlo ahí lo movía al arranque de la segunda toma, y el
 * teardown —que corre una sola vez al final— limpiaba solo esa mitad.
 * Comprobado: la corrida borró 1 vacante y dejó la otra en producción.
 */
let desde: string | null = null

export const flujo: TutorialFlow = {
  slug: 'pedir-puestos',
  mdFile: 'solicitar-puestos-de-servicio.md',
  gifAlt: 'Elegir el comité, sumar cupos a los puestos y enviar la solicitud',

  async setup(admin) {
    desde ??= new Date().toISOString()
    await crearCuentaDeAcceso(admin as never, {
      email: SOFIA, password: PASSWORD, nombre: '[prueba] Sofía Servidores',
      role: 'coordinador_servidores',
      camposMiembro: { external_id: 'PRUEBA-9010', gender: 'F' },
    })
    // Cédula de prueba: sin ella sale el banner «Falta tu cédula» en las tomas.
    await admin.from('members').update({ cedula: '9-9999-9010' }).eq('email', SOFIA)

    // La corrida anterior la limpia su propio teardown. Acá no se borra nada
    // «por si acaso»: un borrado amplio en producción, corriendo justo antes
    // de grabar, es la forma de llevarse por delante una solicitud real que
    // entró mientras tanto. Si quedó basura de una corrida que se cayó, el
    // teardown lo avisa y se mira a mano.
  },

  async run(t: Tools) {
    // 1 · Entrar directo a la pantalla de pedir cupos
    await t.goto('/login?redirect=/servidores/puestos/pedir-cupos')
    await t.fill('input[placeholder*="ejemplo@correo"]', SOFIA)
    await t.fill('input[type="password"]', PASSWORD)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/servidores/puestos/pedir-cupos**', { timeout: 30_000 })
    await t.page.getByText('Solicitar puestos de servicio').first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1200)
    await t.shot('01-pantalla')

    // 2 · Elegir el comité. Hasta que no se elige uno no hay puestos que
    //     mostrar, así que es el primer paso de verdad.
    //
    //     EL COMITÉ VA POR NOMBRE Y NO POR ÍNDICE. La primera versión usaba
    //     `{ index: 1 }` y salió «Area Comunidad», cuyo único puesto es
    //     «Director de Área»: un tutorial sobre pedir colaboradores mostrando
    //     que se pide un director. El índice 1 es «el primero de la lista»,
    //     que cambia solo cuando alguien crea un área.
    //
    //     Comité Hombres tiene seis puestos con colaboradores de verdad y no
    //     está en ninguno de los flujos que estamos cambiando, así que el
    //     video no se queda viejo por nuestro propio trabajo.
    await t.click(t.page.getByLabel('Seleccionar comité'))
    await t.page.selectOption('select[aria-label="Seleccionar comité"]', { label: 'Comité Hombres' })
    await t.pause(1200)
    await t.badge(2)
    await t.shot('02-comite')

    // 3 · Sumar cupos. Se suma DOS veces al primer puesto para que en el video
    //     se vea que el número cambia — con un solo clic no se nota.
    const sumar = t.page.getByRole('button', { name: /^Sumar un cupo a / }).first()
    await sumar.waitFor({ timeout: 20_000 })
    await t.click(sumar)
    await t.pause(500)
    await t.click(sumar)
    await t.pause(900)
    await t.badge(3)
    await t.shot('03-cupos')

    // 4 · Enviar
    const enviar = t.page.getByRole('button', { name: 'Enviar solicitud' })
    await enviar.waitFor({ timeout: 20_000 })
    await t.badge(4)
    await t.pause(700)
    await t.click(enviar)
    await t.pause(2000)
    await t.shot('04-enviada')
  },

  async teardown(admin) {
    /**
     * LO QUE DEJA UNA CORRIDA, y por qué me lo equivoqué la primera vez.
     *
     * La pantalla NO pega contra `/api/servers/position-requests`, que es
     * donde yo miré: pega contra `/api/servers/vacancies/request`, que
     * escribe en **`vacancies`** y notifica con el tipo
     * **`vacancy_request_new`**. Mi primer teardown borraba de
     * `position_requests` filtrando por `position_request` — dos nombres
     * equivocados a la vez— así que no borró NADA y quedaron 4 vacantes
     * falsas y 16 avisos en la campana de tres personas reales. Hubo que
     * limpiarlo a mano.
     *
     * La lección no es «fijarse mejor»: es que el teardown tiene que
     * VERIFICAR que borró algo. Por eso cuenta y avisa si le dio cero.
     *
     * El corte va por la hora de inicio de ESTA corrida y no por «lo de hoy»:
     * mientras se graba puede entrar una solicitud de verdad, y en
     * producción una solicitud real es el pedido de un comité que alguien
     * está esperando.
     */
    /**
     * Si no hay ventana, NO SE BORRA NADA.
     *
     * La primera versión de esto ponía `new Date(0)` como respaldo «por si
     * acaso», que en esta tabla significa BORRAR TODAS LAS VACANTES DE
     * PRODUCCIÓN. Un respaldo que convierte un bug chico en catástrofe no es
     * un respaldo. Si `desde` falta es que el setup no corrió, y entonces no
     * hay nada de esta corrida que limpiar.
     */
    if (!desde) {
      console.warn('    ⚠ sin ventana de corrida: no se borra nada. Revisá `vacancies` a mano.')
      return
    }
    const { count: vacantes } = await admin.from('vacancies')
      .delete({ count: 'exact' }).gte('created_at', desde)
    const { count: avisos } = await admin.from('internal_notifications')
      .delete({ count: 'exact' })
      .eq('type', 'vacancy_request_new').gte('created_at', desde)
    console.log(`    (${vacantes ?? 0} vacante(s) y ${avisos ?? 0} aviso(s) de prueba, borrados)`)
    if (!vacantes) {
      console.warn('    ⚠ el teardown no borró ninguna vacante. Si la corrida envió una')
      console.warn('      solicitud, quedó en producción: revisá `vacancies` a mano.')
    }
  },

  mdImages: [],
}
