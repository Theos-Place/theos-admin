/**
 * FLUJO 3 · Mi perfil: completar la cédula y corregir mis datos (Daniel Intermedio).
 * REPETIBLE: el setup borra cédula y ocupación para que el banner "Falta tu
 * cédula" aparezca y la edición tenga qué corregir; el teardown repone la
 * cédula de prueba (los otros tutoriales de Daniel no deben mostrar el banner).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { credenciales, type TutorialFlow, type Tools } from './lib'

const { email, password } = credenciales()
const CEDULA = '9-9999-9002' // cédula de prueba de Daniel (formato CR válido)

async function danielId(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from('members').select('id').eq('email', email).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error(`No existe ${email}`)
  return id
}

export const flujo: TutorialFlow = {
  slug: 'perfil',
  mdFile: 'mi-perfil.md',
  gifAlt: 'El flujo completo: ver tu perfil, completar tu cédula y corregir tus datos',

  async setup(admin) {
    await admin.from('members').update({ occupation: null, cedula: null }).eq('email', email)
  },

  async run(t: Tools) {
    const admin = (await import('./lib')).adminClient()
    const memberId = await danielId(admin)

    // 1 · Login directo al perfil — sin cédula, el aviso aparece arriba
    await t.goto(`/login?redirect=/miembros/${memberId}`)
    await t.fill('input[placeholder*="ejemplo@correo"]', email)
    await t.fill('input[type="password"]', password)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/miembros/**', { timeout: 30_000 })
    await t.page.getByText('Falta tu cédula').first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1500)
    await t.shot('01-perfil')

    // 2 · "Completar cédula" lleva directo al campo (resaltado y con foco)
    await t.badge(2)
    await t.click(t.page.getByRole('link', { name: /completar cédula/i }))
    await t.page.locator('#edit-cedula').waitFor({ timeout: 30_000 })
    await t.pause(1000)
    await t.shot('02-completar-cedula')

    // 3 · Llenar la cédula
    await t.fill('#edit-cedula', CEDULA)
    await t.badge(3)
    await t.pause(600)
    await t.shot('03-cedula')

    // 4 · De paso, corregir otro dato (la ocupación)
    await t.fill('#edit-profession', 'Ingeniería en Sistemas')
    await t.badge(4)
    await t.pause(600)
    await t.shot('04-ocupacion')

    // 5 · Guardar — de vuelta al perfil, el aviso ya no está
    await t.click(t.page.getByRole('button', { name: /guardar cambios/i }))
    await t.page.waitForURL(u => !String(u).includes('/editar'), { timeout: 30_000 })
    // Recarga completa: el aviso de cédula sale del contexto de sesión, que
    // solo se refresca con un load de verdad.
    await t.goto(`/miembros/${memberId}`)
    await t.page.getByText('Daniel Intermedio').first().waitFor({ timeout: 30_000 })
    await t.badge(5)
    await t.pause(1500)
    await t.shot('05-guardado')
  },

  async teardown(admin) {
    // Ocupación limpia para la próxima corrida; cédula puesta para que el
    // banner no salga en los OTROS tutoriales que usan a Daniel.
    await admin.from('members').update({ occupation: null, cedula: CEDULA }).eq('email', email)
  },

  mdImages: [],
}
