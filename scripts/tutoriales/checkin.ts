/**
 * FLUJO 7 · Check-in de una charla (Evelyn Eventos, encargada de eventos).
 * REPETIBLE: el setup asegura la cuenta de Evelyn, mueve la charla [prueba]
 * a HOY (para que salga "En curso" en el selector) y borra los check-ins de
 * la corrida anterior.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearCuentaDeAcceso } from '../lib/cuentas-de-prueba'
import { credenciales, type TutorialFlow, type Tools } from './lib'

credenciales() // guard @prueba. (las credenciales de Evelyn van en duro abajo)
const EVELYN = 'evelyn.eventos@prueba.theosplace.invalid'
const PASSWORD = 'Prueba.Agosto.2026' // contraseña única del seed
const CHARLA = '[prueba] Charla de bienvenida'
const ANA = 'Ana Nivel Uno' // sin familia en el seed → va directo a la tarjeta

async function ensureCharla(admin: SupabaseClient): Promise<string> {
  // Siempre HOY: media hora de empezada, dos horas por delante → "En curso".
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

export const flujo: TutorialFlow = {
  slug: 'checkin',
  mdFile: 'check-in-de-una-charla.md',
  gifAlt: 'El flujo completo: elegir la charla, buscar a la persona y registrarla',

  async setup(admin) {
    // Cuenta de la encargada (idempotente). El external_id PRUEBA-9001 está
    // fuera de la secuencia del seed pero dentro de su prefijo: el script de
    // limpieza la borra junto con el resto del set.
    await crearCuentaDeAcceso(admin as never, {
      email: EVELYN, password: PASSWORD, nombre: '[prueba] Evelyn Eventos',
      role: 'encargado_eventos',
      camposMiembro: { external_id: 'PRUEBA-9001', gender: 'F' },
    })
    // Cédula de prueba: sin ella, el banner "Falta tu cédula" sale en todas
    // las tomas del tutorial.
    await admin.from('members').update({ cedula: '9-9999-9001' }).eq('email', EVELYN)
    const eventId = await ensureCharla(admin)
    await admin.from('event_checkins').delete().eq('event_id', eventId)
    console.log('    (charla movida a hoy, check-ins de la corrida anterior borrados)')
  },

  async run(t: Tools) {
    // 1 · Login que aterriza en el selector de check-in (eventos de hoy)
    await t.goto('/login?redirect=/eventos/checkin')
    await t.fill('input[placeholder*="ejemplo@correo"]', EVELYN)
    await t.fill('input[type="password"]', PASSWORD)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/eventos/checkin**', { timeout: 30_000 })
    await t.page.getByText(CHARLA).filter({ visible: true }).first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1200)
    await t.shot('01-eventos-de-hoy')

    // 2 · Elegir la charla → la pantalla de registro
    await t.click(t.page.getByText(CHARLA).filter({ visible: true }).first())
    await t.page.getByText('Escanear QR').first().waitFor({ timeout: 30_000 })
    await t.badge(2)
    await t.pause(1000)
    await t.shot('02-charla')

    // 3 · Buscar a la persona por nombre (la alternativa al QR)
    await t.fill('input[placeholder*="Buscar por nombre"]', 'Ana Nivel')
    await t.page.getByText(ANA).filter({ visible: true }).first().waitFor({ timeout: 15_000 })
    await t.badge(3)
    await t.pause(800)
    await t.shot('03-buscar')

    // 4 · La tarjeta de confirmación (Participante / Servidor)
    await t.click(t.page.getByText(ANA).filter({ visible: true }).first())
    await t.page.getByRole('button', { name: 'Participante' }).waitFor({ timeout: 15_000 })
    await t.badge(4)
    await t.pause(800)
    await t.shot('04-confirmar')

    // 5 · Confirmar → aparece en Registrados
    await t.click(t.page.getByRole('button', { name: 'Participante' }))
    await t.page.getByRole('button', { name: 'Participante' }).waitFor({ state: 'detached', timeout: 15_000 })
    await t.page.getByText(ANA).filter({ visible: true }).first().waitFor({ timeout: 15_000 })
    await t.badge(5)
    await t.pause(1500)
    await t.shot('05-registrado')
  },

  async teardown(admin) {
    const { data } = await admin.from('events').select('id').eq('title', CHARLA).maybeSingle()
    if (data) await admin.from('event_checkins').delete().eq('event_id', (data as { id: string }).id)
  },

  mdImages: [],
}
