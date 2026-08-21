/**
 * FLUJO 4 · Ver el calendario e inscribirme a un evento (Daniel Intermedio).
 * REPETIBLE: el setup asegura el evento [prueba] (futuro, con inscripción,
 * gratuito) y borra la inscripción de la corrida anterior.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { credenciales, type TutorialFlow, type Tools } from './lib'

const { email, password } = credenciales()
const EVENTO = '[prueba] Taller de Alabanza'

async function ensureEvento(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from('events').select('id').eq('title', EVENTO).maybeSingle()
  if (data) return (data as { id: string }).id
  const { data: nuevo, error } = await admin.from('events').insert({
    title: EVENTO, event_type: 'taller', location: '[prueba] Salón principal',
    starts_at: '2026-08-29T15:00:00-06:00', ends_at: '2026-08-29T18:00:00-06:00',
    max_capacity: 30, requires_registration: true, requires_payment: false,
    requires_checkin: true, is_active: true, is_public: false,
  }).select('id').single()
  if (error) throw error
  return (nuevo as { id: string }).id
}

export const flujo: TutorialFlow = {
  slug: 'eventos',
  mdFile: 'inscribirme-a-un-evento.md',
  gifAlt: 'El flujo completo: ver los eventos e inscribirte',

  async setup(admin) {
    const eventId = await ensureEvento(admin)
    const { data: m } = await admin.from('members').select('id').eq('email', email).maybeSingle()
    await admin.from('event_registrations').delete().eq('event_id', eventId).eq('member_id', (m as { id: string }).id)
  },

  async run(t: Tools) {
    // 1 · Login que aterriza en Eventos
    await t.goto('/login?redirect=/eventos')
    await t.fill('input[placeholder*="ejemplo@correo"]', email)
    await t.fill('input[type="password"]', password)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/eventos**', { timeout: 30_000 })
    // La vista por defecto es el calendario: pasar a Lista, donde están las
    // tarjetas con el botón Inscribirme.
    await t.page.getByText('Lista', { exact: true }).first().waitFor({ timeout: 30_000 })
    await t.click(t.page.getByText('Lista', { exact: true }).first())
    await t.page.getByText(EVENTO).filter({ visible: true }).first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1200)
    await t.shot('01-eventos')

    // 2 · Abrir el evento (su ficha, con el botón Inscribirme)
    const admin = (await import('./lib')).adminClient()
    const { data: ev } = await admin.from('events').select('id').eq('title', EVENTO).maybeSingle()
    await t.goto(`/eventos/${(ev as { id: string }).id}`)
    await t.page.getByText('Inscribirme').filter({ visible: true }).first().waitFor({ timeout: 30_000 })
    await t.badge(2)
    await t.pause(800)
    await t.shot('02-evento')

    // 3 · Confirmar la inscripción
    await t.click(t.page.getByText('Inscribirme').filter({ visible: true }).first())
    await t.page.getByText('Confirmar inscripción').first().waitFor({ timeout: 15_000 })
    await t.badge(3)
    await t.pause(800)
    await t.shot('03-confirmar')
    await t.click(t.page.getByRole('button', { name: 'Confirmar inscripción' }))

    // 4 · ¡Inscripción confirmada!
    await t.page.getByText(/Quedaste inscrito|Ya estás inscrito/).first().waitFor({ timeout: 60_000 })
    await t.badge(4)
    await t.pause(1200)
    await t.shot('04-inscrito')
  },

  mdImages: [],
}
