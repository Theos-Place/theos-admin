/**
 * FLUJO 9 · Resolver una solicitud de reubicación (Camila Coordinadora).
 * Bruno pide Nivel 3, pero la solución correcta es reubicarlo al nivel
 * anterior (N2): el selector de grupo destino ofrece ambos niveles.
 * REPETIBLE: el setup asegura la cuenta de Camila, borra la solicitud y la
 * matrícula de la corrida anterior y crea la solicitud [prueba] de Bruno.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearCuentaDeAcceso } from '../lib/cuentas-de-prueba'
import { credenciales, type TutorialFlow, type Tools } from './lib'

credenciales() // guard @prueba. (las credenciales de Camila van en duro abajo)
const CAMILA = 'camila.coordinadora@prueba.theosplace.invalid'
const PASSWORD = 'Prueba.Agosto.2026' // contraseña única del seed
const BRUNO = 'bruno.nivel.tres@prueba.theosplace.invalid'
const GRUPO_N2 = '[prueba] Grupo N2 en matrícula'
const RAZON = '[prueba] Se mudó de zona y quiere seguir con sus estudios.'

/** Deshace lo que deja una corrida: la solicitud [prueba] y la matrícula que
 *  crea la resolución (con su cobro — el pago referencia la inscripción, así
 *  que hay que borrarlo primero o el delete falla por FK). */
async function deshacer(admin: SupabaseClient, bruno: string, grupoN2: string): Promise<void> {
  await admin.from('study_requests').delete().eq('member_id', bruno).ilike('reason', '%[prueba]%')
  const { data: enrs } = await admin.from('study_enrollments')
    .select('id').eq('member_id', bruno).eq('group_id', grupoN2)
  const enrIds = ((enrs ?? []) as Array<{ id: string }>).map(e => e.id)
  if (enrIds.length > 0) {
    await admin.from('payments').delete().in('enrollment_id', enrIds)
    await admin.from('study_enrollments').delete().in('id', enrIds)
  }
  // También los pagos huérfanos (la FK deja enrollment_id en NULL si la
  // inscripción se borró antes): un 'matricula' pendiente dispara el guard
  // PAG-2 y bloquea la siguiente resolución.
  await admin.from('payments').delete()
    .eq('member_id', bruno).eq('study_group_id', grupoN2)
    .eq('concept', 'matricula').eq('status', 'pending')
}

async function ids(admin: SupabaseClient): Promise<{ bruno: string; grupoN2: string }> {
  const [{ data: b }, { data: g }] = await Promise.all([
    admin.from('members').select('id').eq('email', BRUNO).maybeSingle(),
    admin.from('study_groups').select('id').eq('name', GRUPO_N2).maybeSingle(),
  ])
  if (!b || !g) throw new Error('Falta Bruno o el grupo N2 del seed — corré el seed')
  return { bruno: (b as { id: string }).id, grupoN2: (g as { id: string }).id }
}

export const flujo: TutorialFlow = {
  slug: 'reubicacion',
  mdFile: 'resolver-una-reubicacion.md',
  gifAlt: 'El flujo completo: tomar la solicitud, elegir el grupo destino y resolverla',

  async setup(admin) {
    await crearCuentaDeAcceso(admin as never, {
      email: CAMILA, password: PASSWORD, nombre: '[prueba] Camila Coordinadora',
      role: 'coordinador_estudios',
      camposMiembro: { external_id: 'PRUEBA-9005', gender: 'F' },
    })
    await admin.from('members').update({ cedula: '9-9999-9005' }).eq('email', CAMILA)

    const { bruno, grupoN2 } = await ids(admin)
    await deshacer(admin, bruno, grupoN2)

    // La solicitud abierta de Bruno: pide N3 (inserción directa a la BD — no
    // dispara la notificación por correo a los coordinadores reales).
    const { error } = await admin.from('study_requests').insert({
      member_id: bruno, request_type: 'relocation', needed_study_code: 'N3',
      reason: RAZON, last_leader_name: '[prueba] Dora Dirigente',
      proposed_days: ['M'], proposed_zones: ['Heredia'], wants_folleto: false,
    })
    if (error) throw error
    console.log('    (solicitud [prueba] de Bruno creada; corrida anterior deshecha)')
  },

  async run(t: Tools) {
    const admin = (await import('./lib')).adminClient()
    const { grupoN2 } = await ids(admin)

    // 1 · Login que aterriza en la cola de solicitudes (tab Reubicaciones)
    await t.goto('/login?redirect=/estudios/solicitudes')
    await t.fill('input[placeholder*="ejemplo@correo"]', CAMILA)
    await t.fill('input[type="password"]', PASSWORD)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/estudios/solicitudes**', { timeout: 30_000 })
    // El tab por defecto es Prematrimonial: pasar a Reubicaciones.
    await t.page.getByText('Reubicaciones', { exact: true }).first().waitFor({ timeout: 30_000 })
    await t.click(t.page.getByText('Reubicaciones', { exact: true }).first())
    await t.page.getByText('Bruno Nivel Tres').first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1200)
    await t.shot('01-cola')

    // 2 · Expandir la solicitud y tomarla (queda a nombre de quien la trabaja)
    await t.click(t.page.getByText('Bruno Nivel Tres').first())
    await t.page.getByRole('button', { name: 'Tomar' }).first().waitFor({ timeout: 15_000 })
    await t.click(t.page.getByRole('button', { name: 'Tomar' }).first())
    await t.page.getByText('Solicitud tomada').first().waitFor({ timeout: 20_000 })
    await t.badge(2)
    await t.pause(1200)
    await t.shot('02-tomada')
    // Tomada = pasa al filtro "En revisión": cambiar el chip y, si la tarjeta
    // no quedó expandida del paso anterior, expandirla.
    await t.click(t.page.getByRole('button', { name: 'En revisión' }).first())
    await t.page.getByText('Bruno Nivel Tres').first().waitFor({ timeout: 15_000 })
    await t.pause(800)
    if (!(await t.page.getByRole('button', { name: 'Resolver' }).first().isVisible())) {
      await t.click(t.page.getByText('Bruno Nivel Tres').first())
    }

    // 3 · Resolver: elegir el grupo destino. Pidió N3, pero el selector
    //     también ofrece el nivel anterior (N2) — acá la solución correcta.
    await t.click(t.page.getByRole('button', { name: 'Resolver' }).first())
    await t.page.locator('#relocation-target-group').waitFor({ timeout: 20_000 })
    await t.badge(3)
    await t.pause(1000)
    await t.shot('03-resolver')
    await t.page.selectOption('#relocation-target-group', grupoN2)
    await t.fill('#request-review-notes', 'Se reubica al Nivel 2: le falta completarlo antes del Nivel 3.')
    await t.badge(4)
    await t.pause(800)
    await t.shot('04-grupo')

    // 4 · Confirmar → la matrícula al grupo destino queda hecha
    await t.click(t.page.getByRole('button', { name: 'Confirmar resolución' }))
    await t.page.getByText('Solicitud marcada como resuelta').first().waitFor({ timeout: 30_000 })
    await t.badge(5)
    await t.pause(1500)
    await t.shot('05-resuelta')
  },

  async teardown(admin) {
    const { bruno, grupoN2 } = await ids(admin)
    await deshacer(admin, bruno, grupoN2)
  },

  mdImages: [],
}
