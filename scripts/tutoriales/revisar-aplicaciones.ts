/**
 * FLUJO · Revisar y aceptar aplicaciones a puestos de servicio
 * (Sofía Servidores, coordinadora de servidores).
 *
 * TODO EL ESCENARIO ES DE PRUEBA, Y NO ES EXAGERACIÓN. Aceptar una aplicación
 * DA DE ALTA a la persona en el puesto y le sincroniza los roles que ese
 * puesto otorga: grabar esto contra un comité real metería a una persona
 * falsa a servir, con permisos, y le avisaría al encargado de ese comité. Por
 * eso el setup crea su propio comité, su puesto y su vacante, y el teardown
 * se los lleva.
 *
 * Lo que NO se puede aislar son los avisos a RH y staff: pasar a «En
 * revisión» y a «Aceptada» les notifica, y son personas reales. El teardown
 * los borra por ventana de tiempo — la ventana se fija UNA vez aunque el
 * runner llame al setup dos veces, una por viewport. Eso último me lo enseñó
 * el tutorial anterior dejando basura en producción.
 *
 * Uso:
 *   npx tsx scripts/tutoriales/run.ts revisar-aplicaciones
 */
import { crearCuentaDeAcceso } from '../lib/cuentas-de-prueba'
import { credenciales, type TutorialFlow, type Tools } from './lib'

credenciales() // guard @prueba.
export const SOFIA = 'sofia.servidores@prueba.theosplace.invalid'
const PASSWORD = 'Prueba.Agosto.2026'
const MARCA = '[prueba]'
const COMITE = `${MARCA} Comité de Pruebas`
const PUESTO = `${MARCA} Colaborador de Pruebas`

/** Inicio de la corrida. Se fija una sola vez: ver el comentario de arriba. */
let desde: string | null = null

export const flujo: TutorialFlow = {
  slug: 'revisar-aplicaciones',
  mdFile: 'revisar-aplicaciones-de-puestos.md',
  gifAlt: 'Buscar una aplicación en la cola, mandarla al encargado y aceptarla',

  /**
   * SOLO ESCRITORIO, y eso es un hallazgo, no una comodidad: en celular esta
   * pantalla NO deja revisar. La tabla con «Ver aplicación» es
   * `hidden md:block`, y en móvil la fila es un enlace al puesto. O sea que
   * quien lleva las aplicaciones no puede trabajarlas desde el teléfono.
   * Mientras eso siga así, grabar la versión móvil sería mostrar algo que no
   * se puede hacer.
   */
  viewports: ['desktop'],

  async setup(admin) {
    desde ??= new Date().toISOString()

    await crearCuentaDeAcceso(admin as never, {
      email: SOFIA, password: PASSWORD, nombre: '[prueba] Sofía Servidores',
      role: 'coordinador_servidores',
      camposMiembro: { external_id: 'PRUEBA-9010', gender: 'F' },
    })
    await admin.from('members').update({ cedula: '9-9999-9010' }).eq('email', SOFIA)

    // Quien aplica. Una persona de prueba más, no alguien real.
    const correoAplicante = 'ana.aplicante@prueba.theosplace.invalid'
    await crearCuentaDeAcceso(admin as never, {
      email: correoAplicante, password: PASSWORD, nombre: '[prueba] Ana Aplicante',
      role: 'miembro', camposMiembro: { external_id: 'PRUEBA-9011', gender: 'F' },
    })

    // Comité y puesto PROPIOS: sin encargado, así nadie real recibe el aviso
    // de «Enviada al encargado».
    const { data: areaYa } = await admin.from('areas').select('id').eq('name', COMITE).maybeSingle()
    const areaId = (areaYa as { id: string } | null)?.id
      ?? ((await admin.from('areas').insert({ name: COMITE, area_type: 'committee', is_active: true })
            .select('id').single()).data as { id: string }).id

    const { data: posYa } = await admin.from('service_positions')
      .select('id').eq('title', PUESTO).eq('area_id', areaId).maybeSingle()
    const positionId = (posYa as { id: string } | null)?.id
      ?? ((await admin.from('service_positions').insert({ title: PUESTO, area_id: areaId, is_active: true })
            .select('id').single()).data as { id: string }).id

    // Vacante publicada + una aplicación recibida, que es lo que la pantalla muestra.
    const { data: vacYa } = await admin.from('vacancies')
      .select('id').eq('position_id', positionId).maybeSingle()
    const vacancyId = (vacYa as { id: string } | null)?.id
      ?? ((await admin.from('vacancies').insert({
            committee_id: areaId, position_id: positionId, title: PUESTO,
            slots_total: 2, status: 'publicada', published_at: new Date().toISOString(),
          }).select('id').single()).data as { id: string }).id

    const { data: ana } = await admin.from('members').select('id').eq('email', correoAplicante).maybeSingle()
    const anaId = (ana as { id: string }).id
    const { data: appYa } = await admin.from('applications')
      .select('id').eq('vacancy_id', vacancyId).eq('applicant_id', anaId).maybeSingle()
    if (appYa) {
      // Volver al principio: el video empieza con la aplicación recién llegada.
      await admin.from('applications').update({ status: 'pending' }).eq('id', (appYa as { id: string }).id)
      // Y deshacer la asignación que dejó la corrida anterior al aceptarla.
      await admin.from('volunteers').delete().eq('member_id', anaId).eq('position_id', positionId)
    } else {
      await admin.from('applications').insert({
        vacancy_id: vacancyId, applicant_id: anaId, status: 'pending',
        applied_at: new Date().toISOString(),
      })
    }
  },

  async run(t: Tools) {
    /**
     * DOS TRAMPAS DE LOCALIZADORES EN ESTA PANTALLA, las dos me costaron una
     * corrida entera:
     *
     * 1. La cola se pinta DOS veces —tarjetas para celular, tabla para
     *    escritorio— y según el ancho una está oculta. Un `.first()` a secas
     *    agarra la del DOM, que puede ser la invisible.
     *
     * 2. Los FILTROS de arriba tienen los MISMOS textos que los estados
     *    («Enviada al encargado», «Aceptada»…). Buscar por texto suelto
     *    encuentra el chip del filtro, que está detrás del modal abierto, y
     *    el error que da no es «no lo encuentro» sino «algo lo tapa» — que
     *    se lee como un problema de timing y no lo es.
     *
     * 3. Dentro del panel, el TEXTO DE AYUDA de un estado contiene el NOMBRE
     *    de otro: el de «En revisión» dice «Aceptada, pero para otro puesto…».
     *    Un `getByText('Aceptada')` agarra esa explicación, que viene antes
     *    en el DOM, y el video terminó marcando el estado equivocado — sin
     *    fallar, que es lo peor. Por eso los estados van con `exact: true`.
     *
     * Por eso: todo pide `visible=true`, lo del panel se busca DENTRO del
     * panel, y los nombres de estado van exactos.
     */
    const panel = () => t.page.locator('div[role="presentation"]')
    // 1 · La cola de aplicaciones
    await t.goto('/login?redirect=/servidores/aplicaciones')
    await t.fill('input[placeholder*="ejemplo@correo"]', SOFIA)
    await t.fill('input[type="password"]', PASSWORD)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/servidores/aplicaciones**', { timeout: 30_000 })
    await t.page.getByText('[prueba] Ana Aplicante').locator('visible=true').first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1400)
    await t.shot('01-cola')

    // 2 · Buscarla, que es lo que se hace cuando la cola tiene decenas
    await t.fill('input[aria-label="Buscar por nombre o puesto"]', 'Ana Aplicante')
    await t.pause(1200)
    await t.badge(2)
    await t.shot('02-buscar')

    // 3 · Abrirla con «Ver aplicación» — la FILA no abre nada; el botón sí.
    //     El panel muestra los estados con su explicación al lado, que es lo
    //     que hace que no haya que adivinar cuál poner.
    await t.click(t.page.getByRole('button', { name: /ver aplicación/i }).locator('visible=true').first())
    await panel().getByText('Enviada al encargado', { exact: true }).first().waitFor({ timeout: 20_000 })
    await t.pause(1500)
    await t.badge(3)
    await t.shot('03-detalle')

    // 4 · Mandarla al encargado del puesto, que es el paso normal antes de
    //     decidir. Se elige el estado y se guarda.
    await t.click(panel().getByText('Enviada al encargado', { exact: true }).first())
    await t.pause(700)
    await t.click(panel().getByRole('button', { name: 'Guardar' }))
    await t.page.getByText(/Qued\u00f3 como/).locator('visible=true').first().waitFor({ timeout: 20_000 })
    // ESPERAR A QUE EL MODAL SE VAYA antes de tocar nada más. El overlay
    // cubre toda la pantalla (`fixed inset-0 z-[1000]`), así que el clic
    // siguiente no falla por «no lo encuentro» sino por «algo lo tapa», que
    // es un error que se lee distinto y cuesta más ubicar.
    await t.page.locator('div[role="presentation"].fixed.inset-0').waitFor({ state: 'detached', timeout: 20_000 })
    await t.badge(4)
    await t.pause(1500)
    await t.shot('04-al-encargado')

    // 5 · Aceptarla. ACÁ ES DONDE LA PERSONA QUEDA ASIGNADA al puesto y
    //     recibe los roles que ese puesto da — por eso el artículo insiste en
    //     que este paso no se deshace desde esta pantalla.
    await t.click(t.page.getByRole('button', { name: /ver aplicación/i }).locator('visible=true').first())
    await panel().getByText('Aceptada', { exact: true }).first().waitFor({ timeout: 20_000 })
    await t.pause(800)
    await t.click(panel().getByText('Aceptada', { exact: true }).first())
    await t.pause(700)
    await t.badge(5)
    await t.click(panel().getByRole('button', { name: 'Guardar' }))
    // Esperar la CONFIRMACIÓN, no un tiempo fijo: con `pause(2000)` el video
    // cortaba en «Guardando…» y el último fotograma —el que queda de
    // portada— no mostraba el resultado.
    await t.page.getByText(/Qued\u00f3 como/).locator('visible=true').first().waitFor({ timeout: 20_000 })
    await t.page.getByText('ACEPTADA').locator('visible=true').first().waitFor({ timeout: 20_000 })
    await t.pause(2200)
    await t.shot('05-aceptada')
  },

  async teardown(admin) {
    if (!desde) {
      console.warn('    ⚠ sin ventana de corrida: no se borra nada. Revisá a mano.')
      return
    }
    const { data: ana } = await admin.from('members')
      .select('id').eq('email', 'ana.aplicante@prueba.theosplace.invalid').maybeSingle()
    const anaId = (ana as { id: string } | null)?.id
    const { data: area } = await admin.from('areas').select('id').eq('name', COMITE).maybeSingle()
    const areaId = (area as { id: string } | null)?.id

    if (anaId) {
      await admin.from('applications').delete().eq('applicant_id', anaId)
      // Si la corrida llegó a aceptar, la dejó asignada al puesto.
      await admin.from('volunteers').delete().eq('member_id', anaId)
    }
    if (areaId) {
      const { data: pos } = await admin.from('service_positions').select('id').eq('area_id', areaId)
      const ids = ((pos ?? []) as Array<{ id: string }>).map(p => p.id)
      if (ids.length) await admin.from('vacancies').delete().in('position_id', ids)
      await admin.from('service_positions').delete().eq('area_id', areaId)
      await admin.from('areas').delete().eq('id', areaId)
    }
    // Los avisos a RH y staff son lo único que toca a gente real.
    const { count } = await admin.from('internal_notifications')
      .delete({ count: 'exact' }).gte('created_at', desde)
      .in('type', ['application_status', 'vacancy_request_new', 'application_new'])
    console.log(`    (escenario de prueba borrado · ${count ?? 0} aviso(s))`)
  },

  mdImages: [],
}
