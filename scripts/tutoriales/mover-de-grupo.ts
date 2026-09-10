/**
 * FLUJO 13 · Mover a alguien de grupo, con su pago (Camila Coordinadora).
 *
 * Marta se matriculó en un SCJ de ₡5.000 y pagó. La pasan a un Panorama de
 * ₡20.000: su pago viaja como abono y le queda pendiente la diferencia. Es el
 * caso que motivó el feature — antes esto se hacía sacándola y volviéndola a
 * matricular, lo que le generaba un cobro nuevo teniendo el pago hecho.
 *
 * REPETIBLE y AUTOCONTENIDO: el setup crea sus propios grupos y su propia
 * estudiante [prueba], y el teardown los borra. No depende del seed grande,
 * que hoy no está cargado en producción.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearCuentaDeAcceso } from '../lib/cuentas-de-prueba'
import { credenciales, type TutorialFlow, type Tools } from './lib'

credenciales() // guard @prueba.
const CAMILA = 'camila.coordinadora@prueba.theosplace.invalid'
const PASSWORD = 'Prueba.Agosto.2026'
const MARTA = 'marta.movida@prueba.theosplace.invalid'
const GRUPO_BARATO = '[prueba] SCJ para mover — lunes'
const GRUPO_CARO = '[prueba] Panorama para mover — jueves'

type Ids = { marta: string; barato: string; caro: string }

async function planPorCodigo(admin: SupabaseClient, code: string): Promise<{ id: string; cost: number }> {
  const { data } = await admin.from('study_plans').select('id, cost').eq('code', code).maybeSingle()
  if (!data) throw new Error(`falta el plan ${code}`)
  return data as { id: string; cost: number }
}

async function asegurarGrupo(
  admin: SupabaseClient, nombre: string, planId: string, dias: string[], hora: string,
): Promise<string> {
  const { data: ya } = await admin.from('study_groups').select('id').eq('name', nombre).maybeSingle()
  if (ya) return (ya as { id: string }).id
  const { data, error } = await admin.from('study_groups').insert({
    name: nombre, plan_id: planId, status: 'en_matricula',
    schedule_days: dias, schedule_time: hora, location: '[prueba] Sala de ejemplo',
    zone: 'este-sj', max_students: 10,
    starts_at: '2026-10-05', ends_at: '2026-12-14',
  }).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

/** Deshace lo que deja una corrida. El pago referencia la inscripción, así que
 *  va primero o el delete rebota por la FK. */
async function deshacer(admin: SupabaseClient, ids: Partial<Ids>): Promise<void> {
  if (ids.marta) {
    await admin.from('payments').delete().eq('member_id', ids.marta)
    await admin.from('study_enrollments').delete().eq('member_id', ids.marta)
  }
}

/** Los grupos [prueba] también se van: dejarlos ahí los mete en el listado de
 *  grupos que ven los coordinadores de verdad. El setup los vuelve a crear. */
async function borrarGrupos(admin: SupabaseClient): Promise<void> {
  for (const nombre of [GRUPO_BARATO, GRUPO_CARO]) {
    const { data } = await admin.from('study_groups').select('id').eq('name', nombre).maybeSingle()
    const id = (data as { id: string } | null)?.id
    if (!id) continue
    // Por si alguna corrida dejó algo colgando: sin esto el delete rebota.
    const { data: enrs } = await admin.from('study_enrollments').select('id').eq('group_id', id)
    const ids = ((enrs ?? []) as Array<{ id: string }>).map(e => e.id)
    if (ids.length) {
      await admin.from('payments').delete().in('enrollment_id', ids)
      await admin.from('study_enrollments').delete().in('id', ids)
    }
    await admin.from('payments').delete().eq('study_group_id', id)
    await admin.from('study_groups').delete().eq('id', id)
  }
}

export const flujo: TutorialFlow = {
  slug: 'mover-de-grupo',
  mdFile: 'mover-de-grupo.md',
  gifAlt: 'Mover a alguien de grupo: elegir destino, ver qué pasa con el pago y confirmar',

  async setup(admin) {
    await crearCuentaDeAcceso(admin as never, {
      email: CAMILA, password: PASSWORD, nombre: '[prueba] Camila Coordinadora',
      role: 'coordinador_estudios',
      camposMiembro: { external_id: 'PRUEBA-9005', gender: 'F' },
    })
    await crearCuentaDeAcceso(admin as never, {
      email: MARTA, password: PASSWORD, nombre: '[prueba] Marta Movida',
      role: 'miembro', camposMiembro: { external_id: 'PRUEBA-9013', gender: 'F' },
    })
    const { data: m } = await admin.from('members').select('id').eq('email', MARTA).single()
    const marta = (m as { id: string }).id

    const scj = await planPorCodigo(admin, 'SCJ')
    const pan = await planPorCodigo(admin, 'PAN')
    const barato = await asegurarGrupo(admin, GRUPO_BARATO, scj.id, ['L'], '19:00')
    const caro = await asegurarGrupo(admin, GRUPO_CARO, pan.id, ['J'], '19:00')

    await deshacer(admin, { marta })

    // Marta, matriculada y con su matrícula PAGADA: es lo que hace interesante
    // el caso — la plata ya está y tiene que viajar con ella.
    const { data: e, error } = await admin.from('study_enrollments').insert({
      member_id: marta, group_id: barato, plan_id: scj.id,
      status: 'enrolled', enrolled_at: new Date().toISOString(),
    }).select('id').single()
    if (error) throw error
    await admin.from('payments').insert({
      member_id: marta, amount: scj.cost, currency: 'CRC', payment_method: 'comprobante',
      concept: 'matricula', entity_type: 'study_group',
      enrollment_id: (e as { id: string }).id, study_group_id: barato,
      status: 'paid', review_status: 'aprobado',
      payment_date: new Date().toISOString().slice(0, 10),
      description: `Matrícula · ${GRUPO_BARATO}`,
    })
    console.log(`    (Marta matriculada y al día en el grupo de ₡${scj.cost}; destino de ₡${pan.cost} listo)`)
  },

  async run(t: Tools) {
    const admin = (await import('./lib')).adminClient()
    const { data: g } = await admin.from('study_groups').select('id').eq('name', GRUPO_BARATO).single()
    const barato = (g as { id: string }).id

    // 1 · Entrar al grupo, pestaña Participantes
    await t.goto(`/login?redirect=/estudios/grupos/${barato}`)
    await t.fill('input[placeholder*="ejemplo@correo"]', CAMILA)
    await t.fill('input[type="password"]', PASSWORD)
    await t.click(t.page.getByRole('button', { name: 'Iniciar sesión' }))
    await t.page.waitForURL('**/estudios/grupos/**', { timeout: 30_000 })
    await t.page.getByText('Marta Movida').first().waitFor({ timeout: 30_000 })
    await t.badge(1)
    await t.pause(1200)
    await t.shot('01-roster')

    // 2 · "Mover de grupo…" en su fila
    const fila = t.page.locator('tbody tr', { hasText: 'Marta Movida' }).last()
    await t.click(fila.getByRole('button', { name: 'Mover de grupo…' }).first())
    await t.page.getByRole('heading', { name: /Mover a .* de grupo/ }).waitFor({ timeout: 20_000 })
    await t.badge(2)
    await t.pause(1000)
    await t.shot('02-modal')

    // 3 · Elegir el destino. Cada opción ya dice qué pasa con la plata.
    await t.fill('#buscar-grupo-destino', 'Panorama para mover')
    await t.pause(600)
    await t.click(t.page.locator('button', { hasText: GRUPO_CARO }).first())
    await t.page.getByText(/le queda un cobro pendiente/).first().waitFor({ timeout: 15_000 })
    await t.badge(3)
    await t.pause(1500)
    await t.shot('03-confirmacion')

    // 4 · Confirmar → la matrícula vieja queda transferida y el pago viaja
    await t.click(t.page.getByRole('button', { name: 'Mover de grupo', exact: true }))
    await t.page.getByText(/como transferida/).first().waitFor({ timeout: 30_000 })
    await t.badge(4)
    await t.pause(1800)
    await t.shot('04-movida')
  },

  async teardown(admin) {
    const { data: m } = await admin.from('members').select('id').eq('email', MARTA).maybeSingle()
    await deshacer(admin, { marta: (m as { id: string } | null)?.id })
    await borrarGrupos(admin)
  },

  mdImages: [],
}
