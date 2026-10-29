/**
 * FLUJO · Levantar un tiquete de soporte desde el check-in (Evelyn Eventos).
 * Entra al check-in de la charla [prueba], abre «Tiquete de soporte», cuenta
 * qué pasó y lo levanta. REPETIBLE: el setup asegura la cuenta y mueve la
 * charla a HOY; el teardown borra el tiquete que dejó la grabación.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearCuentaDeAcceso } from '../lib/cuentas-de-prueba'
import { credenciales, type TutorialFlow, type Tools } from './lib'

credenciales() // guard @prueba.
const EVELYN = 'evelyn.eventos@prueba.theosplace.invalid'
const PASSWORD = 'Prueba.Agosto.2026'
const CHARLA = '[prueba] Charla de bienvenida'
const DETALLE = '[prueba tutorial] A Ana Asistente le sale otra familia al hacer check-in; su hija es Sofía Asistente.'

async function ensureCharla(admin: SupabaseClient): Promise<string> {
  const ahora = Date.now()
  const horario = {
    starts_at: new Date(ahora - 30 * 60_000).toISOString(),
    ends_at: new Date(ahora + 2 * 3600_000).toISOString(),
  }
  const { data } = await admin.from('events').select('id').eq('title', CHARLA).maybeSingle()
  if (data) {
    const id = (data as { id: string }).id
    await admin.from('events').update(horario).eq('id', id)
    return id
  }
  const { data: nuevo, error } = await admin.from('events').insert({
    title: CHARLA, event_type: 'charla', location: '[prueba] Salón principal',
    ...horario, requires_registration: false, requires_payment: false,
    requires_checkin: true, is_active: true, is_public: false,
  }).select('id').single()
  if (error) throw error
  return (nuevo as { id: string }).id
}

async function borrarTiquetesDePrueba(admin: SupabaseClient): Promise<void> {
  const { data } = await admin.from('support_tickets').select('id').like('details', '[prueba tutorial]%')
  const ids = ((data ?? []) as Array<{ id: string }>).map(t => t.id)
  if (ids.length === 0) return
  await admin.from('support_ticket_status_history').delete().in('ticket_id', ids)
  await admin.from('support_tickets').delete().in('id', ids)
}

export const flujo: TutorialFlow = {
  slug: 'tiquete',
  mdFile: 'tiquete-de-soporte-desde-el-checkin.md',
  gifAlt: 'El flujo completo: abrir el tiquete desde el check-in, contar qué pasó y levantarlo',

  async setup(admin) {
    await crearCuentaDeAcceso(admin as never, {
      email: EVELYN, password: PASSWORD, nombre: '[prueba] Evelyn Eventos',
      role: 'encargado_eventos',
      camposMiembro: { external_id: 'PRUEBA-9001', gender: 'F' },
    })
    await admin.from('members').update({ cedula: '9-9999-9001' }).eq('email', EVELYN)
    await ensureCharla(admin)
    await borrarTiquetesDePrueba(admin)
    console.log('    (charla movida a hoy, tiquetes de prueba borrados)')
  },

  async run(t: Tools) {
    // 1 · Login que aterriza en el selector de check-in
    await t.goto('/login?redirect=/eventos/checkin')
    await t.fill('input[placeholder*="ejemplo@correo"]', EVELYN)
    await t.fill('input[type="password"]', PASSWORD)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/eventos/checkin**', { timeout: 30_000 })
    await t.page.getByText(CHARLA).filter({ visible: true }).first().waitFor({ timeout: 30_000 })
    await t.click(t.page.getByText(CHARLA).filter({ visible: true }).first())
    await t.page.getByText('Escanear QR').first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1200)
    await t.shot('01-checkin')

    // 2 · El botón «Tiquete de soporte», arriba a la derecha
    await t.badge(2)
    await t.click(t.page.getByRole('button', { name: 'Levantar un tiquete de soporte' }))
    await t.page.getByLabel('Detalle del tiquete').waitFor({ timeout: 15_000 })
    await t.pause(800)
    await t.shot('02-modal')

    // 3 · Contar qué pasó
    await t.badge(3)
    await t.page.getByLabel('Detalle del tiquete').pressSequentially(DETALLE, { delay: 18 })
    await t.pause(800)
    await t.shot('03-detalle')

    // 4 · Levantar → «Listo»
    await t.badge(4)
    await t.click(t.page.getByRole('button', { name: 'Levantar tiquete' }))
    await t.page.getByText('Listo. Soporte lo ve en su cola').waitFor({ timeout: 20_000 })
    await t.pause(1800)
    await t.shot('04-listo')
  },

  async teardown(admin) {
    await borrarTiquetesDePrueba(admin)
  },

  mdImages: [],
}
