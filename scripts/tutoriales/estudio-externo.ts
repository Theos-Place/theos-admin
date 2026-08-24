/**
 * FLUJO 10 · Registrar un estudio que la persona llevó FUERA de Theos
 * (Camila Coordinadora, coordinadora de estudios).
 *
 * El caso: Ana llegó a Theos habiendo llevado Nivel 2 en otra iglesia. Se le
 * registra a mano para que el sistema lo reconozca como prerrequisito y pueda
 * matricularse en Nivel 3.
 *
 * REPETIBLE: el setup borra la matrícula externa de la corrida anterior, así
 * que el video siempre muestra el historial sin ese estudio.
 */
import { crearCuentaDeAcceso } from '../lib/cuentas-de-prueba'
import { credenciales, type TutorialFlow, type Tools } from './lib'
import { CAMILA } from './folletos'

credenciales() // guard @prueba.
const PASSWORD = 'Prueba.Agosto.2026' // contraseña única del seed
const PLAN = 'N2'
const FUENTE = 'Iglesia Vida Nueva, Cartago'

// El flujo crea SUS PROPIAS fixtures en vez de depender del set completo de
// datos de prueba: para grabar un video de seis pasos no hace falta sembrar
// media base. La convención de nombres sí se respeta —'[prueba]' en el nombre y
// external_id 'PRUEBA-*'— que es exactamente lo que busca
// limpiar-datos-de-prueba.ts para borrarlas.
const SUJETO_EMAIL = 'ana.externa@prueba.theosplace.invalid'

/** El id de la persona a la que se le registra el estudio. */
async function sujetoId(admin: never): Promise<string> {
  const a = admin as unknown as {
    from: (t: string) => {
      select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } }
    }
  }
  const { data } = await a.from('members').select('id').eq('email', SUJETO_EMAIL).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error(`No existe ${SUJETO_EMAIL} — el setup del flujo debería haberla creado`)
  return id
}

export const flujo: TutorialFlow = {
  slug: 'estudio-externo',
  mdFile: 'registrar-un-estudio-externo.md',
  gifAlt: 'Registrar un estudio llevado fuera de Theos, desde el tab Administrativo',
  // Sin capturas sueltas en el .md: el artículo se apoya en el video y en la
  // lista de pasos escrita, que es más fácil de mantener que seis imágenes.
  mdImages: [],

  async setup(admin) {
    // Camila es la misma coordinadora del flujo de folletos: una sola cuenta de
    // coordinación para todos los tutoriales que necesitan ese rol.
    await crearCuentaDeAcceso(admin as never, {
      email: CAMILA, password: PASSWORD, nombre: '[prueba] Camila Coordinadora',
      role: 'coordinador_estudios',
      camposMiembro: { external_id: 'PRUEBA-9005', gender: 'F' },
    })
    await admin.from('members').update({ cedula: '9-9999-9005' }).eq('email', CAMILA)

    // La persona del caso: llegó a Theos con un Nivel 2 de otra iglesia. Sin
    // cuenta de acceso — no la necesita, solo hace falta su expediente.
    await crearCuentaDeAcceso(admin as never, {
      email: SUJETO_EMAIL, password: PASSWORD, nombre: '[prueba] Ana Externa',
      camposMiembro: { external_id: 'PRUEBA-9010', gender: 'F', cedula: '9-9999-9010' },
    })

    const id = await sujetoId(admin as never)
    const { data: plan } = await admin.from('study_plans').select('id').eq('code', PLAN).maybeSingle()
    // Borrar SOLO la matrícula externa de la corrida anterior: las internas del
    // seed se dejan, que son las que dan contexto al historial en el video.
    await admin.from('study_enrollments').delete()
      .eq('member_id', id).eq('plan_id', (plan as { id: string }).id).eq('es_externo', true)
    console.log('    (estudio externo de la corrida anterior borrado)')
  },

  async run(t: Tools) {
    const admin = (await import('./lib')).adminClient()
    const id = await sujetoId(admin as never)

    // 1 · Entrar y abrir el expediente de la persona
    await t.goto(`/login?redirect=/miembros/${id}`)
    await t.fill('input[placeholder*="ejemplo@correo"]', CAMILA)
    await t.fill('input[type="password"]', PASSWORD)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/miembros/**', { timeout: 30_000 })
    await t.page.getByRole('button', { name: 'Administrativo' }).waitFor({ timeout: 30_000 })
    await t.badge(1) // paso 1: abrir el expediente
    await t.pause(1000)
    await t.shot('01-expediente')

    // 2 · Tab Administrativo → Acciones de estudios
    await t.click(t.page.getByRole('button', { name: 'Administrativo' }))
    await t.page.getByRole('button', { name: 'Agregar estudio' }).waitFor({ timeout: 30_000 })
    await t.badge(2)
    await t.pause(900)
    await t.shot('02-tab-administrativo')

    // 3 · Abrir "Agregar estudio"
    await t.click(t.page.getByRole('button', { name: 'Agregar estudio' }))
    const modal = t.page.locator('[role="dialog"]')
    await modal.getByText('Agregar estudio').first().waitFor({ timeout: 15_000 })
    await t.badge(3)
    await t.pause(700)
    await t.shot('03-modal')

    // 4 · Elegir el estudio y marcar que lo llevó por fuera
    await modal.locator('#hist-estudio').selectOption(PLAN)
    await t.pause(500)
    // Clic real en el check: cambiar el DOM sin evento no actualiza React y el
    // campo de procedencia no aparece (comprobado el 2026-08-24).
    await t.click(modal.locator('input[type="checkbox"]').first())
    await modal.locator('#hist-fuente').waitFor({ timeout: 10_000 })
    await t.badge(4)
    await t.pause(600)
    await t.shot('04-marcado-externo')

    // 5 · De dónde lo trajo y guardar
    await t.badge(5) // el badge va ANTES de la captura, o sale el número anterior
    await modal.locator('#hist-fuente').fill(FUENTE)
    await t.pause(700)
    await t.shot('05-procedencia')
    await t.click(modal.getByRole('button', { name: 'Agregar' }))
    await t.page.getByText('Estudio agregado').first().waitFor({ timeout: 20_000 })
    await t.pause(900)

    // 6 · El resultado: la etiqueta "Externo" en el historial
    await t.click(t.page.getByRole('button', { name: 'Participación' }))
    await t.page.getByText('Historial de estudios').first().waitFor({ timeout: 20_000 })
    await t.page.getByText('Externo').first().waitFor({ timeout: 20_000 })
    await t.badge(6)
    await t.pause(1400)
    await t.shot('06-etiqueta-externo')
    await t.badge(null)
  },
}
