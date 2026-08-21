/**
 * FLUJO 3 · Mi perfil y corregir mis datos (Daniel Intermedio).
 * REPETIBLE: el setup limpia la ocupación para que la edición tenga qué corregir.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { credenciales, type TutorialFlow, type Tools } from './lib'

const { email, password } = credenciales()

async function danielId(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from('members').select('id').eq('email', email).maybeSingle()
  const id = (data as { id: string } | null)?.id
  if (!id) throw new Error(`No existe ${email}`)
  return id
}

export const flujo: TutorialFlow = {
  slug: 'perfil',
  mdFile: 'mi-perfil.md',
  gifAlt: 'El flujo completo: ver tu perfil y corregir tus datos',

  async setup(admin) {
    await admin.from('members').update({ occupation: null }).eq('email', email)
  },

  async run(t: Tools) {
    const admin = (await import('./lib')).adminClient()
    const memberId = await danielId(admin)

    // 1 · Login directo al perfil
    await t.goto(`/login?redirect=/miembros/${memberId}`)
    await t.fill('input[placeholder*="ejemplo@correo"]', email)
    await t.fill('input[type="password"]', password)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/miembros/**', { timeout: 30_000 })
    await t.page.getByText('Daniel Intermedio').first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1500)
    await t.shot('01-perfil')

    // 2 · Revisar los datos (la ficha con sus pestañas)
    await t.badge(2)
    await t.pause(1000)
    await t.shot('02-datos')

    // 3 · Editar y corregir un dato (la ocupación)
    await t.goto(`/miembros/${memberId}/editar`)
    await t.page.locator('#edit-profession').waitFor({ timeout: 30_000 })
    await t.badge(3)
    await t.shot('03-editar')
    await t.fill('#edit-profession', 'Ingeniería en Sistemas')
    await t.pause(600)
    await t.shot('04-corregido')

    // 4 · Guardar
    await t.badge(4)
    await t.click(t.page.getByRole('button', { name: /guardar cambios/i }))
    await t.page.waitForURL(u => !String(u).includes('/editar'), { timeout: 30_000 })
    await t.badge(null)
    await t.pause(1500)
    await t.shot('05-guardado')
  },

  async teardown(admin) {
    await admin.from('members').update({ occupation: null }).eq('email', email)
  },

  mdImages: [],
}
